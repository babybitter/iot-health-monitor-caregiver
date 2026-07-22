const config = require("../config/index.js");

const textBytes = text => {
  const encoded = unescape(encodeURIComponent(String(text)));
  const bytes = new Uint8Array(encoded.length);
  for (let index = 0; index < encoded.length; index += 1) bytes[index] = encoded.charCodeAt(index);
  return bytes;
};

const mqttString = text => {
  const bytes = textBytes(text);
  const result = new Uint8Array(bytes.length + 2);
  result[0] = bytes.length >> 8;
  result[1] = bytes.length & 255;
  result.set(bytes, 2);
  return result;
};

const remainingLength = length => {
  const bytes = [];
  let value = length;
  do {
    let digit = value % 128;
    value = Math.floor(value / 128);
    if (value > 0) digit |= 128;
    bytes.push(digit);
  } while (value > 0);
  return new Uint8Array(bytes);
};

const join = arrays => {
  const length = arrays.reduce((sum, item) => sum + item.length, 0);
  const result = new Uint8Array(length);
  let offset = 0;
  arrays.forEach(item => {
    result.set(item, offset);
    offset += item.length;
  });
  return result.buffer;
};

const buildConnectPacket = () => {
  const protocol = mqttString("MQTT");
  const clientId = mqttString(`caregiver_monitor_${Date.now()}_${Math.floor(Math.random() * 10000)}`);
  const username = config.mqtt.username ? mqttString(config.mqtt.username) : new Uint8Array(0);
  const password = config.mqtt.password ? mqttString(config.mqtt.password) : new Uint8Array(0);
  let flags = 2;
  if (username.length) flags |= 128;
  if (password.length) flags |= 64;
  const variableHeader = new Uint8Array(protocol.length + 4);
  variableHeader.set(protocol, 0);
  variableHeader[protocol.length] = 4;
  variableHeader[protocol.length + 1] = flags;
  variableHeader[protocol.length + 2] = config.mqtt.keepalive >> 8;
  variableHeader[protocol.length + 3] = config.mqtt.keepalive & 255;
  const payload = [clientId, username, password];
  const bodyLength = variableHeader.length + payload.reduce((sum, item) => sum + item.length, 0);
  return join([new Uint8Array([16]), remainingLength(bodyLength), variableHeader].concat(payload));
};

const buildSubscribePacket = (topic, packetId) => {
  const id = new Uint8Array([packetId >> 8, packetId & 255]);
  const topicBytes = mqttString(topic);
  const qos = new Uint8Array([0]);
  const length = id.length + topicBytes.length + qos.length;
  return join([new Uint8Array([130]), remainingLength(length), id, topicBytes, qos]);
};

const buildPublishPacket = (topic, payload) => {
  const topicBytes = mqttString(topic);
  const serialized = typeof payload === "string" ? payload : JSON.stringify(payload);
  const payloadBytes = textBytes(serialized);
  const length = topicBytes.length + payloadBytes.length;
  return join([new Uint8Array([48]), remainingLength(length), topicBytes, payloadBytes]);
};

const decodeUtf8 = bytes => {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index]);
  try {
    return decodeURIComponent(escape(binary));
  } catch (error) {
    return binary;
  }
};

class RealtimeClient {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.connecting = null;
    this.packetId = 1;
    this.listeners = [];
    this.manualClose = false;
    this.reconnectTimer = null;
    this.keepaliveTimer = null;
  }

  isEnabled() {
    return Boolean(config.mqtt.enabled && config.mqtt.url);
  }

  isConnected() {
    return this.connected;
  }

  connect() {
    if (!this.isEnabled()) return Promise.reject(new Error("MQTT 实时连接未启用"));
    if (this.connected && this.socket) return Promise.resolve();
    if (this.connecting) return this.connecting;
    this.manualClose = false;
    clearTimeout(this.reconnectTimer);

    this.connecting = new Promise((resolve, reject) => {
      let settled = false;
      const finish = (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutTimer);
        this.connecting = null;
        if (error) reject(error);
        else resolve();
      };
      const timeoutTimer = setTimeout(() => {
        const error = new Error("MQTT 连接超时");
        this.emit({ type: "connection", connected: false, error: error.message });
        finish(error);
        if (this.socket) this.socket.close({ code: 1000, reason: "connect timeout" });
      }, config.requestTimeout);

      const socket = wx.connectSocket({ url: config.mqtt.url, protocols: ["mqtt"] });
      this.socket = socket;
      socket.onOpen(() => socket.send({ data: buildConnectPacket() }));
      socket.onMessage(event => {
        const packet = this.handlePacket(event.data);
        if (packet === "connected") {
          this.connected = true;
          this.startKeepalive();
          this.subscribeConfiguredTopics();
          this.emit({ type: "connection", connected: true, error: "" });
          finish();
        } else if (packet === "rejected") {
          const error = new Error("MQTT 服务器拒绝连接");
          finish(error);
          socket.close({ code: 1000, reason: "mqtt rejected" });
        }
      });
      socket.onError(() => {
        this.connected = false;
        const error = new Error("MQTT 连接失败，请检查网络和合法域名配置");
        this.emit({ type: "connection", connected: false, error: error.message });
        finish(error);
        this.scheduleReconnect();
      });
      socket.onClose(() => {
        if (this.socket === socket) this.socket = null;
        this.connected = false;
        this.stopKeepalive();
        this.emit({ type: "connection", connected: false, error: this.manualClose ? "" : "MQTT 连接已断开" });
        finish(new Error("MQTT 连接已断开"));
        this.scheduleReconnect();
      });
    });

    return this.connecting;
  }

  handlePacket(raw) {
    if (!(raw instanceof ArrayBuffer)) return "ignored";
    const bytes = new Uint8Array(raw);
    if (!bytes.length) return "ignored";
    const packetType = bytes[0] >> 4;
    if (packetType === 2) {
      const returnCode = bytes.length >= 4 ? bytes[3] : 255;
      if (returnCode === 0) return "connected";
      this.emit({ type: "connection", connected: false, error: `MQTT 鉴权失败（${returnCode}）` });
      return "rejected";
    }
    if (packetType !== 3) return "ignored";
    let multiplier = 1;
    let remaining = 0;
    let offset = 1;
    let digit;
    do {
      digit = bytes[offset];
      remaining += (digit & 127) * multiplier;
      multiplier *= 128;
      offset += 1;
    } while ((digit & 128) !== 0 && offset < bytes.length);
    if (offset + 2 > bytes.length) return "ignored";
    const topicLength = (bytes[offset] << 8) + bytes[offset + 1];
    offset += 2;
    const topic = decodeUtf8(bytes.slice(offset, offset + topicLength));
    offset += topicLength;
    const payloadText = decodeUtf8(bytes.slice(offset));
    let payload = payloadText;
    try { payload = JSON.parse(payloadText); } catch (error) { payload = payloadText; }
    this.emit({ type: "message", topic, payload, receivedAt: new Date().toISOString() });
    return "message";
  }

  subscribeConfiguredTopics() {
    if (!this.connected || !this.socket) return false;
    const topics = Array.from(new Set(Object.keys(config.mqtt.topics).map(key => config.mqtt.topics[key]).filter(Boolean)));
    topics.forEach(topic => {
      this.packetId = this.packetId >= 65535 ? 1 : this.packetId + 1;
      this.socket.send({ data: buildSubscribePacket(topic, this.packetId) });
    });
    return true;
  }

  publish(topic, payload) {
    if (!this.connected || !this.socket) return Promise.reject(new Error("MQTT 实时连接不可用"));
    return new Promise((resolve, reject) => {
      this.socket.send({
        data: buildPublishPacket(topic, payload),
        success: resolve,
        fail: () => reject(new Error("设备控制指令发送失败"))
      });
    });
  }

  on(listener) {
    if (typeof listener !== "function") return () => {};
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index >= 0) this.listeners.splice(index, 1);
    };
  }

  emit(event) {
    this.listeners.slice().forEach(listener => listener(event));
  }

  startKeepalive() {
    this.stopKeepalive();
    this.keepaliveTimer = setInterval(() => {
      if (this.connected && this.socket) this.socket.send({ data: new Uint8Array([192, 0]).buffer });
    }, Math.max(20000, (config.mqtt.keepalive - 15) * 1000));
  }

  stopKeepalive() {
    clearInterval(this.keepaliveTimer);
    this.keepaliveTimer = null;
  }

  scheduleReconnect() {
    if (this.manualClose || !this.isEnabled() || this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect().catch(() => {});
    }, config.mqtt.reconnectPeriod);
  }

  disconnect() {
    this.manualClose = true;
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.stopKeepalive();
    if (this.socket) this.socket.close({ code: 1000, reason: "application close" });
    this.socket = null;
    this.connected = false;
    this.connecting = null;
  }
}

module.exports = new RealtimeClient();
