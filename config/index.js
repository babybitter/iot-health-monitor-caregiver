const config = {
  apiBaseUrl: "https://api.healthtrack.top",
  requestTimeout: 20000,

  // 当前实体演示只有一套监护设备，因此不在客户端虚构患者列表。
  careSubject: {
    id: "current-care-subject",
    displayName: "当前照护对象",
    location: "当前监护设备",
    careLevel: "信息待机构配置"
  },

  mqtt: {
    enabled: true,
    hostDev: "ws://106.14.12.227:8083/mqtt",
    hostProd: "wss://mqtt.healthtrack.top:8084/mqtt",
    url: "ws://106.14.12.227:8083/mqtt",
    username: "test",
    password: "test123",
    keepalive: 60,
    reconnectPeriod: 3000,
    topics: {
      light: "patient/monitor/light",
      pressure: "patient/monitor/pressure",
      temperature: "patient/monitor/temperature",
      humidity: "patient/monitor/humidity",
      breathing: "patient/monitor/breathing",
      heartRate: "patient/monitor/heart_rate",
      bloodOxygen: "patient/monitor/blood_oxygen",
      bodyTemperature: "patient/upload/data/temperature",
      weight: "patient/monitor/weight",
      weightBegin: "patient/monitor/weight-begin",
      infusionSpeed: "patient/monitor/infusion-speed",
      deviceStatus: "patient/status/device",
      dataUpload: "patient/upload/data",
      deviceAdvice: "patient/advice/device",
      vitalTemperature: "patient/upload/data/temperature",
      hardwareDevices: "home/devices/onoff/#"
    },
    publishTopic: "patient/control/device",
    weightDriveTopic: "patient/monitor/weight-drive"
  }
};

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
