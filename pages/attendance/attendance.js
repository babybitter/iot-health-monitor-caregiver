const repository = require("../../services/repository");

Page({
  data: {
    loading: true,
    error: "",
    submitting: false,
    caregiver: {},
    attendance: {},
    logs: []
  },

  onLoad() {
    this.loadAttendance();
  },

  onPullDownRefresh() {
    this.loadAttendance(true).finally(() => wx.stopPullDownRefresh());
  },

  async loadAttendance(silent) {
    if (!silent) this.setData({ loading: true, error: "" });
    try {
      const [attendance, logs] = await Promise.all([repository.getAttendance(), repository.listAttendance()]);
      this.setData({ loading: false, error: "", caregiver: repository.getCaregiverProfile(), attendance, logs });
    } catch (error) {
      this.setData({ loading: false, error: error.message || "考勤记录加载失败" });
    }
  },

  retryLoad() {
    this.loadAttendance();
  },

  handleClock() {
    if (this.data.submitting || this.data.attendance.status === "checked_out") return;
    const action = this.data.attendance.status === "checked_in" ? "check_out" : "check_in";
    if (action === "check_out") {
      wx.showModal({
        title: "确认签退",
        content: "请确认本班次任务与交接事项已经处理。",
        confirmText: "确认签退",
        confirmColor: "#c43a47",
        success: result => {
          if (result.confirm) this.submitClock(action);
        }
      });
      return;
    }
    this.submitClock(action);
  },

  async submitClock(action) {
    if (this.data.submitting) return;
    this.setData({ submitting: true });
    try {
      const attendance = await repository.clock(action);
      this.setData({ attendance, submitting: false });
      wx.showToast({ title: action === "check_in" ? "签到成功" : "签退成功", icon: "success" });
    } catch (error) {
      this.setData({ submitting: false });
      wx.showToast({ title: error.message || "操作失败", icon: "none" });
    }
  }
});

