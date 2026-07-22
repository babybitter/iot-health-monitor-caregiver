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
  const clientId = mqttString(`caregiver_${Date.now()}_${Math.floor(Math.random() * 10000)}`);
  const username = config.mqtt.username ? mqttString(config.mqtt.username) : new Uint8Array(0);
  const password = config.mqtt.password ? mqttString(config.mqtt.password) : new Uint8Array(0);
  let flags = 2;
  if (username.length) flags |= 128;
  if (password.length) flags |= 64;
  const variableHeader = new Uint8Array(protocol.length + 4);
  variableHeader.set(protocol, 0);
  variableHeader[protocol.length] = 4;
  variableHeader[protocol.length + 1] = flags;
  variableHeader[protocol.length + 2] = 0;
  variableHeader[protocol.length + 3] = 60;
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
  const payloadBytes = textBytes(JSON.stringify(payload));
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
    this.packetId = 1;
    this.listeners = [];
  }

  isEnabled() {
    return Boolean(config.mqtt.enabled && config.mqtt.url);
  }

  connect() {
    if (!this.isEnabled()) return Promise.reject(new Error("实时连接未配置"));
    if (this.connected && this.socket) return Promise.resolve();

    return new Promise((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          reject(new Error("实时连接超时"));
        }
      }, config.requestTimeout);

      this.socket = wx.connectSocket({ url: config.mqtt.url, protocols: ["mqtt"] });
      this.socket.onOpen(() => this.socket.send({ data: buildConnectPacket() }));
      this.socket.onMessage(event => {
        const type = this.handlePacket(event.data);
        if (type === "connected" && !settled) {
          settled = true;
          clearTimeout(timer);
          this.connected = true;
          resolve();
        }
      });
      this.socket.onError(() => {
        this.connected = false;
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          reject(new Error("实时连接失败"));
        }
      });
      this.socket.onClose(() => {
        this.connected = false;
        this.emit({ type: "connection", connected: false });
      });
    });
  }

  handlePacket(raw) {
    if (!(raw instanceof ArrayBuffer)) return "ignored";
    const bytes = new Uint8Array(raw);
    const packetType = bytes[0] >> 4;
    if (packetType === 2 && bytes[bytes.length - 1] === 0) {
      this.emit({ type: "connection", connected: true });
      return "connected";
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
    const topicLength = (bytes[offset] << 8) + bytes[offset + 1];
    offset += 2;
    const topic = decodeUtf8(bytes.slice(offset, offset + topicLength));
    offset += topicLength;
    const payloadText = decodeUtf8(bytes.slice(offset));
    let payload = payloadText;
    try { payload = JSON.parse(payloadText); } catch (error) { payload = payloadText; }
    this.emit({ type: "message", topic, payload });
    return "message";
  }

  subscribeSelectedPatient() {
    if (!this.connected || !this.socket) return false;
    const prefix = config.mqtt.topicPrefix;
    const topics = [
      `${prefix}/monitor/heart_rate`,
      `${prefix}/monitor/breathing`,
      `${prefix}/monitor/blood_oxygen`,
      `${prefix}/upload/data/temperature`,
      `${prefix}/monitor/weight`,
      `${prefix}/monitor/weight-begin`,
      `${prefix}/monitor/infusion-speed`,
      `${prefix}/status/device`
    ];
    topics.forEach(topic => {
      this.packetId = this.packetId >= 65535 ? 1 : this.packetId + 1;
      this.socket.send({ data: buildSubscribePacket(topic, this.packetId) });
    });
    return true;
  }

  publish(topic, payload) {
    if (!this.connected || !this.socket) return Promise.reject(new Error("设备实时连接不可用"));
    return new Promise((resolve, reject) => {
      this.socket.send({ data: buildPublishPacket(topic, payload), success: resolve, fail: () => reject(new Error("控制指令发送失败")) });
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

  disconnect() {
    if (this.socket) this.socket.close({ code: 1000, reason: "page hidden" });
    this.socket = null;
    this.connected = false;
  }
}

module.exports = new RealtimeClient();
