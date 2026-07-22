module.exports = {
  dataMode: "remote",
  apiBaseUrl: "https://your-api.example.com",
  mqtt: {
    enabled: true,
    url: "wss://your-mqtt.example.com/mqtt",
    username: "replace-with-local-credential",
    password: "replace-with-local-credential",
    topicPrefix: "patient"
  }
};

