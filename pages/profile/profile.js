const repository = require("../../services/repository");

Page({
  data: {
    login: { show: false, avatar: "/images/default-avatar.png" },
    caregiver: {},
    lastLoginTime: "暂无记录"
  },

  onLoad() {
    this.loadProfile();
  },

  onShow() {
    this.loadProfile();
  },

  formatTime(date) {
    const pad = value => String(value).padStart(2, "0");
    return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  },

  loadProfile() {
    const caregiver = repository.getCaregiverProfile();
    const userInfo = wx.getStorageSync("caregiver_user_info");
    const lastLoginTime = wx.getStorageSync("caregiver_last_login_time") || "暂无记录";
    this.setData({
      caregiver,
      lastLoginTime,
      login: {
        show: Boolean(userInfo && userInfo.avatarUrl),
        avatar: userInfo && userInfo.avatarUrl ? userInfo.avatarUrl : caregiver.avatar || "/images/default-avatar.png"
      }
    });
  },

  chooseAvatar(event) {
    const avatarUrl = event.detail.avatarUrl;
    const lastLoginTime = this.formatTime(new Date());
    try {
      const caregiver = repository.saveCaregiverProfile({ avatar: avatarUrl });
      wx.setStorageSync("caregiver_user_info", { avatarUrl, loginTime: Date.now() });
      wx.setStorageSync("caregiver_last_login_time", lastLoginTime);
      this.setData({ caregiver, lastLoginTime, login: { show: true, avatar: avatarUrl } });
      wx.showToast({ title: "登录信息已更新", icon: "success" });
    } catch (error) {
      wx.showToast({ title: error.message || "头像保存失败", icon: "none" });
    }
  },

  openMenu(event) {
    const key = event.currentTarget.dataset.key;
    if (key === "profile") {
      const caregiver = this.data.caregiver;
      wx.showModal({
        title: "护工基本信息",
        content: `姓名：${caregiver.name}\n岗位：${caregiver.role}\n工号：${caregiver.employeeNo}\n机构：${caregiver.organization}`,
        showCancel: false
      });
      return;
    }
    const routes = {
      attendance: "/pages/attendance/attendance",
      records: "/pages/records/records",
      certificates: "/pages/certificates/certificates",
      training: "/pages/training/training"
    };
    if (routes[key]) wx.navigateTo({ url: routes[key] });
  },

  logout() {
    wx.showModal({
      title: "确认退出",
      content: "退出后将清除本机头像和登录时间，不会删除照护记录。",
      confirmText: "退出",
      confirmColor: "#c43a47",
      success: result => {
        if (!result.confirm) return;
        wx.removeStorageSync("caregiver_user_info");
        wx.removeStorageSync("caregiver_last_login_time");
        repository.saveCaregiverProfile({ avatar: "/images/default-avatar.png" });
        this.setData({ login: { show: false, avatar: "/images/default-avatar.png" }, lastLoginTime: "暂无记录" });
        wx.showToast({ title: "已退出登录", icon: "success" });
      }
    });
  }
});
