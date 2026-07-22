const config = require("../config/index.js");
const { evaluateMetric, metricMeta, severityRank } = require("../utils/health");

const metricTypes = ["heartRate", "breathing", "bloodOxygen", "bodyTemperature", "temperature", "humidity", "light", "pressure"];

const createMetrics = () => metricTypes.reduce((result, type) => {
  result[type] = { value: null, status: "unknown", updatedAt: "" };
  return result;
}, {});

const createHistory = () => metricTypes.reduce((result, type) => {
  result[type] = [];
  return result;
}, {});

const createMonitor = () => ({
  metrics: createMetrics(),
  history: createHistory(),
  infusion: { initialWeight: null, remainingWeight: null, speed: null, threshold: null, updatedAt: "" },
  device: { status: "offline", updatedAt: "", advice: "", controls: {} },
  alerts: [],
  lastUpdate: ""
});

let state = {
  caregiver: null,
  networkOnline: true,
  realtimeConnected: false,
  connectionError: "",
  monitor: createMonitor()
};

const listeners = [];
const acknowledged = {};

const initialize = initialState => {
  state = Object.assign({}, state, initialState || {});
};

const getState = () => Object.assign({}, state);

const notify = () => listeners.slice().forEach(listener => listener(getState()));

const setState = patch => {
  state = Object.assign({}, state, patch || {});
  notify();
};

const subscribe = listener => {
  if (typeof listener !== "function") return () => {};
  listeners.push(listener);
  return () => {
    const index = listeners.indexOf(listener);
    if (index >= 0) listeners.splice(index, 1);
  };
};

const numericValue = payload => {
  let value = payload;
  if (value && typeof value === "object") {
    if (value.value !== undefined) value = value.value;
    else if (value.data && value.data.value !== undefined) value = value.data.value;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const metricFromTopic = topic => {
  const topics = config.mqtt.topics;
  const direct = {
    [topics.light]: "light",
    [topics.pressure]: "pressure",
    [topics.temperature]: "temperature",
    [topics.humidity]: "humidity",
    [topics.breathing]: "breathing",
    [topics.heartRate]: "heartRate",
    [topics.bloodOxygen]: "bloodOxygen",
    [topics.bodyTemperature]: "bodyTemperature"
  };
  if (direct[topic]) return direct[topic];
  if (!topic.startsWith("home/devices/onoff/")) return "";
  const sensor = topic.split("/").pop().toLowerCase();
  return ({
    temperature: "temperature", temp: "temperature",
    humidity: "humidity", hum: "humidity",
    light: "light", lux: "light",
    pressure: "pressure", press: "pressure",
    breathing: "breathing", breath: "breathing",
    heartrate: "heartRate", heart: "heartRate",
    oxygen: "bloodOxygen", spo2: "bloodOxygen"
  })[sensor] || "";
};

const rebuildAlerts = monitor => {
  const alerts = metricTypes.reduce((rows, type) => {
    const metric = monitor.metrics[type];
    if (!metric || !["warning", "danger"].includes(metric.status)) return rows;
    const signature = `${metric.value}`;
    if (acknowledged[`metric-${type}`] === signature) return rows;
    const meta = metricMeta[type];
    rows.push({
      id: `metric-${type}`,
      level: metric.status,
      title: `${meta.label}数据异常`,
      description: `最新接收值为 ${metric.value}${meta.unit}，请先核对设备状态和现场情况。`,
      occurredAt: metric.updatedAt,
      valueSignature: signature
    });
    return rows;
  }, []);

  const infusion = monitor.infusion;
  if (Number.isFinite(infusion.initialWeight) && infusion.initialWeight > 0 && Number.isFinite(infusion.remainingWeight)) {
    const percent = infusion.remainingWeight / infusion.initialWeight * 100;
    const level = percent <= 5 ? "danger" : percent <= 20 ? "warning" : "";
    const signature = `${infusion.remainingWeight}`;
    if (level && acknowledged["infusion-low"] !== signature) {
      alerts.push({
        id: "infusion-low",
        level,
        title: "输液余量偏低",
        description: `当前重量 ${infusion.remainingWeight}g，请按流程到现场核对。`,
        occurredAt: infusion.updatedAt,
        valueSignature: signature
      });
    }
  }
  return alerts.sort((left, right) => severityRank(right.level) - severityRank(left.level));
};

const applyMetric = (monitor, type, rawValue, receivedAt) => {
  const value = numericValue(rawValue);
  if (value === null || !metricTypes.includes(type)) return monitor;
  const metrics = Object.assign({}, monitor.metrics, {
    [type]: { value, status: evaluateMetric(type, value), updatedAt: receivedAt }
  });
  const rows = (monitor.history[type] || []).concat([{ time: receivedAt, value }]).slice(-240);
  const history = Object.assign({}, monitor.history, { [type]: rows });
  const next = Object.assign({}, monitor, { metrics, history, lastUpdate: receivedAt });
  next.alerts = rebuildAlerts(next);
  return next;
};

const applyUploadBundle = (monitor, payload, receivedAt) => {
  if (!payload || typeof payload !== "object") return monitor;
  const fieldMap = {
    light: ["light", "light_intensity"],
    pressure: ["pressure"],
    temperature: ["temperature", "temp"],
    humidity: ["humidity", "humi"],
    breathing: ["breathing", "breathing_rate"],
    heartRate: ["heartRate", "heart_rate"],
    bloodOxygen: ["bloodOxygen", "blood_oxygen", "spo2"],
    bodyTemperature: ["bodyTemperature", "body_temperature"]
  };
  let next = monitor;
  Object.keys(fieldMap).forEach(type => {
    const field = fieldMap[type].find(key => payload[key] !== undefined && payload[key] !== null);
    if (field) next = applyMetric(next, type, payload[field], receivedAt);
  });
  return next;
};

const applyDeviceStatus = (monitor, payload, receivedAt) => {
  const device = Object.assign({}, monitor.device);
  if (payload && typeof payload === "object") {
    if (payload.device) {
      device.controls = Object.assign({}, device.controls, { [payload.device]: Boolean(payload.status !== undefined ? payload.status : payload.value) });
    }
    if (typeof payload.online === "boolean") device.status = payload.online ? "online" : "offline";
    else if (["online", "offline", "standby"].includes(payload.status)) device.status = payload.status;
    else device.status = "online";
  } else {
    const value = String(payload).toLowerCase();
    device.status = ["0", "false", "offline"].includes(value) ? "offline" : "online";
  }
  device.updatedAt = receivedAt;
  return Object.assign({}, monitor, { device, lastUpdate: receivedAt });
};

const handleRealtimeEvent = event => {
  if (!event) return;
  if (event.type === "connection") {
    state = Object.assign({}, state, { realtimeConnected: Boolean(event.connected), connectionError: event.error || "" });
    notify();
    return;
  }
  if (event.type !== "message") return;
  const receivedAt = event.receivedAt || new Date().toISOString();
  let monitor = state.monitor;
  const topics = config.mqtt.topics;
  const metric = metricFromTopic(event.topic);
  if (metric) monitor = applyMetric(monitor, metric, event.payload, receivedAt);
  else if (event.topic === topics.dataUpload) monitor = applyUploadBundle(monitor, event.payload, receivedAt);
  else if (event.topic === topics.weightBegin) {
    const value = numericValue(event.payload);
    if (value !== null && value > 0) {
      const infusion = Object.assign({}, monitor.infusion, { initialWeight: value, threshold: Number((value * 0.05).toFixed(2)), updatedAt: receivedAt });
      monitor = Object.assign({}, monitor, { infusion, lastUpdate: receivedAt });
      monitor.alerts = rebuildAlerts(monitor);
    }
  } else if (event.topic === topics.weight) {
    const value = numericValue(event.payload);
    if (value !== null && value >= 0) {
      const infusion = Object.assign({}, monitor.infusion, { remainingWeight: value, updatedAt: receivedAt });
      monitor = Object.assign({}, monitor, { infusion, lastUpdate: receivedAt });
      monitor.alerts = rebuildAlerts(monitor);
    }
  } else if (event.topic === topics.infusionSpeed) {
    const value = numericValue(event.payload);
    if (value !== null && value >= 0) {
      const infusion = Object.assign({}, monitor.infusion, { speed: value, updatedAt: receivedAt });
      monitor = Object.assign({}, monitor, { infusion, lastUpdate: receivedAt });
    }
  } else if (event.topic === topics.deviceStatus) monitor = applyDeviceStatus(monitor, event.payload, receivedAt);
  else if (event.topic === topics.deviceAdvice) {
    const advice = typeof event.payload === "object" ? event.payload.message || event.payload.advice || "收到设备建议" : String(event.payload);
    monitor = Object.assign({}, monitor, { device: Object.assign({}, monitor.device, { advice, updatedAt: receivedAt }), lastUpdate: receivedAt });
  }
  state = Object.assign({}, state, { monitor });
  notify();
};

const acknowledgeAlert = alertId => {
  const alert = state.monitor.alerts.find(item => item.id === alertId);
  if (!alert) return false;
  acknowledged[alertId] = alert.valueSignature;
  const monitor = Object.assign({}, state.monitor);
  monitor.alerts = rebuildAlerts(monitor);
  state = Object.assign({}, state, { monitor });
  notify();
  return true;
};

const getLiveHistory = (metric, range) => {
  const durations = { "2h": 2 * 60 * 60 * 1000, "6h": 6 * 60 * 60 * 1000, "24h": 24 * 60 * 60 * 1000 };
  const cutoff = Date.now() - (durations[range] || durations["2h"]);
  return ((state.monitor.history && state.monitor.history[metric]) || []).filter(item => new Date(item.time).getTime() >= cutoff);
};

module.exports = { initialize, getState, setState, subscribe, handleRealtimeEvent, acknowledgeAlert, getLiveHistory, createMonitor };
