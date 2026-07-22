const config = require("../config");
const storage = require("../utils/storage");

const request = (path, options) => {
  const settings = options || {};
  const token = storage.read("caregiver_auth_token", "");
  const headers = Object.assign({ "Content-Type": "application/json" }, settings.header || {});
  if (token) headers.Authorization = `Bearer ${token}`;

  return new Promise((resolve, reject) => {
    wx.request({
      url: `${config.apiBaseUrl}${path}`,
      method: settings.method || "GET",
      data: settings.data || {},
      header: headers,
      timeout: settings.timeout || config.requestTimeout,
      success(response) {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`服务请求失败（${response.statusCode}）`));
          return;
        }
        const payload = response.data;
        if (payload && payload.success === false) {
          reject(new Error(payload.error || payload.message || "服务返回失败"));
          return;
        }
        resolve(payload && Object.prototype.hasOwnProperty.call(payload, "data") ? payload.data : payload);
      },
      fail(error) {
        const message = error && error.errMsg && error.errMsg.includes("timeout")
          ? "请求超时，请稍后重试"
          : "网络连接失败，请检查网络";
        reject(new Error(message));
      }
    });
  });
};

module.exports = {
  get(path, params) {
    const query = Object.keys(params || {})
      .filter(key => params[key] !== undefined && params[key] !== null && params[key] !== "")
      .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
      .join("&");
    return request(query ? `${path}?${query}` : path);
  },
  post(path, data) {
    return request(path, { method: "POST", data });
  },
  put(path, data) {
    return request(path, { method: "PUT", data });
  }
};

