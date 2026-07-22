const defaults = {
  dataMode: "mock",
  apiBaseUrl: "https://api.healthtrack.top",
  requestTimeout: 20000,
  mqtt: {
    enabled: false,
    url: "wss://mqtt.healthtrack.top:8084/mqtt",
    username: "",
    password: "",
    topicPrefix: "patient"
  }
};

// 微信开发者工具会在打包期解析所有静态 require，不能引用一个可能不存在的
// 本地配置文件。真实环境配置应由发布流程写入，凭据应由登录后的后端接口下发。
const config = Object.assign({}, defaults, {
  mqtt: Object.assign({}, defaults.mqtt)
});

config.thresholds = {
  heartRate: { warningLow: 55, warningHigh: 105, dangerLow: 45, dangerHigh: 130 },
  breathing: { warningLow: 11, warningHigh: 21, dangerLow: 8, dangerHigh: 28 },
  bloodOxygen: { warningLow: 93, warningHigh: 100, dangerLow: 90, dangerHigh: 100 },
  bodyTemperature: { warningLow: 35.8, warningHigh: 37.6, dangerLow: 35.0, dangerHigh: 38.5 },
  temperature: { warningLow: 17, warningHigh: 27, dangerLow: 12, dangerHigh: 32 },
  humidity: { warningLow: 35, warningHigh: 72, dangerLow: 25, dangerHigh: 82 },
  light: { warningLow: 100, warningHigh: 1000, dangerLow: 30, dangerHigh: 1500 },
  pressure: { warningLow: 980, warningHigh: 1040, dangerLow: 950, dangerHigh: 1060 },
  infusionSpeed: { warningLow: 20, warningHigh: 80, dangerLow: 10, dangerHigh: 100 }
};

module.exports = config;
