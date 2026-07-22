const config = require("../config");

const metricMeta = {
  heartRate: { label: "心率", unit: "次/分", precision: 0 },
  breathing: { label: "呼吸", unit: "次/分", precision: 0 },
  bloodOxygen: { label: "血氧", unit: "%", precision: 0 },
  bodyTemperature: { label: "体温", unit: "℃", precision: 1 },
  temperature: { label: "室温", unit: "℃", precision: 1 },
  humidity: { label: "湿度", unit: "%", precision: 0 },
  light: { label: "光照", unit: "lx", precision: 0 },
  pressure: { label: "气压", unit: "hPa", precision: 0 },
  infusionSpeed: { label: "输液滴速", unit: "滴/分", precision: 0 }
};

const evaluateMetric = (type, rawValue) => {
  const value = Number(rawValue);
  if (!Number.isFinite(value)) return "unknown";
  const threshold = config.thresholds[type];
  if (!threshold) return "normal";
  if (value < threshold.dangerLow || value > threshold.dangerHigh) return "danger";
  if (value < threshold.warningLow || value > threshold.warningHigh) return "warning";
  return "normal";
};

const formatMetric = (type, rawValue) => {
  const meta = metricMeta[type] || { label: type, unit: "", precision: 0 };
  const value = Number(rawValue);
  return {
    type,
    label: meta.label,
    unit: meta.unit,
    value: Number.isFinite(value) ? value.toFixed(meta.precision) : "--",
    status: evaluateMetric(type, rawValue)
  };
};

const statusText = status => ({
  normal: "正常",
  warning: "关注",
  danger: "紧急",
  offline: "离线",
  unknown: "暂无"
}[status] || "暂无");

const severityRank = level => ({ danger: 3, warning: 2, normal: 1, unknown: 0 }[level] || 0);

module.exports = { metricMeta, evaluateMetric, formatMetric, statusText, severityRank };
