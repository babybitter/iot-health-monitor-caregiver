const read = (key, fallback) => {
  try {
    const value = wx.getStorageSync(key);
    return value === "" || value === undefined || value === null ? fallback : value;
  } catch (error) {
    return fallback;
  }
};

const write = (key, value) => {
  try {
    wx.setStorageSync(key, value);
    return true;
  } catch (error) {
    return false;
  }
};

const remove = key => {
  try {
    wx.removeStorageSync(key);
    return true;
  } catch (error) {
    return false;
  }
};

module.exports = { read, write, remove };

