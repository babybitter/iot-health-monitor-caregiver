const repository = require("../../services/repository");
const workStore = require("../../store/work-store");
const config = require("../../config/index.js");
const { formatDateTime } = require("../../utils/date");
const { formatMetric } = require("../../utils/health");

Page({
  data: {
    loading: true,
    error: "",
    networkOnline: true,
    realtimeConnected: false,
    connectionError: "",
    clocking: false,
    greeting: "您好",
    caregiver: {},
    shift: {},
    attendance: {},
    counts: { alerts: 0, pendingTasks: 0 },
    alerts: [],
    tasks: [],
    subject: config.careSubject,
    subjectStatus: "等待数据",
    subjectStatusType: "offline",
    lastUpdateLabel: "--",
    latestMetrics: []
  },

  onLoad() {
    this.unsubscribe = workStore.subscribe(state => this.applyLiveState(state));
    this.setData({ greeting: this.getGreeting() });
    this.loadDashboard();
  },

  onShow() {
    if (!this.data.loading) this.loadDashboard(true);
  },

  onUnload() {
    if (this.unsubscribe) this.unsubscribe();
  },

  onPullDownRefresh() {
    const app = getApp();
    const reconnect = app && app.connectRealtime ? app.connectRealtime() : Promise.resolve(false);
    return Promise.all([this.loadDashboard(true), reconnect]).finally(() => wx.stopPullDownRefresh());
  },

  getGreeting() {
    const hour = new Date().getHours();
    if (hour < 6) return "夜间值守";
    if (hour < 12) return "上午好";
    if (hour < 18) return "下午好";
    return "晚上好";
  },

  async loadDashboard(silent) {
    if (!silent) this.setData({ loading: true, error: "" });
    try {
      const dashboard = await repository.getDashboard();
      const tasks = dashboard.tasks.map(item => Object.assign({}, item, {
        statusText: item.status === "processing" ? "进行中" : "待完成"
      }));
      this.setData({
        loading: false,
        error: "",
        caregiver: dashboard.caregiver,
        shift: dashboard.shift,
        attendance: dashboard.attendance,
        tasks,
        counts: dashboard.counts
      });
      this.applyLiveState(workStore.getState());
    } catch (error) {
      this.setData({ loading: false, error: error.message || "工作台加载失败" });
    }
  },

  applyLiveState(state) {
    const monitor = state.monitor;
    const metrics = monitor.metrics;
    const alerts = monitor.alerts.map(item => Object.assign({}, item, {
      timeLabel: formatDateTime(item.occurredAt),
      levelText: item.level === "danger" ? "紧急" : "关注"
    }));
    const latestMetrics = ["heartRate", "bloodOxygen", "bodyTemperature"].map(type => formatMetric(type, metrics[type].value));
    let subjectStatus = "等待数据";
    let subjectStatusType = "offline";
    if (monitor.lastUpdate) {
      subjectStatusType = alerts.some(item => item.level === "danger") ? "danger" : alerts.length ? "warning" : "normal";
      subjectStatus = subjectStatusType === "danger" ? "存在异常" : subjectStatusType === "warning" ? "需要关注" : "数据平稳";
    }
    this.setData({
      networkOnline: state.networkOnline,
      realtimeConnected: state.realtimeConnected,
      connectionError: state.connectionError,
      alerts,
      subjectStatus,
      subjectStatusType,
      lastUpdateLabel: formatDateTime(monitor.lastUpdate),
      latestMetrics,
      counts: Object.assign({}, this.data.counts, { alerts: alerts.length })
    });
  },

  retryLoad() {
    this.loadDashboard();
  },

  handleAttendance() {
    if (this.data.clocking || this.data.attendance.status === "checked_out") return;
    const action = this.data.attendance.status === "checked_in" ? "check_out" : "check_in";
    if (action === "check_out") {
      wx.showModal({
        title: "确认签退",
        content: "请确认本班次任务和交接事项已经处理。签退后本班次状态将结束。",
        confirmText: "确认签退",
        confirmColor: "#c43a47",
        success: result => {
          if (result.confirm) this.submitAttendance(action);
        }
      });
      return;
    }
    this.submitAttendance(action);
  },

  async submitAttendance(action) {
    if (this.data.clocking) return;
    this.setData({ clocking: true });
    try {
      const attendance = await repository.clock(action);
      this.setData({ attendance, clocking: false });
      wx.showToast({ title: action === "check_in" ? "签到成功" : "签退成功", icon: "success" });
    } catch (error) {
      this.setData({ clocking: false });
      wx.showToast({ title: error.message || "操作失败", icon: "none" });
    }
  },

  openTasks() {
    wx.switchTab({ url: "/pages/tasks/tasks" });
  },

  openTask(event) {
    wx.navigateTo({ url: `/pages/task-detail/task-detail?id=${event.currentTarget.dataset.id}` });
  },

  openMonitor() {
    wx.switchTab({ url: "/pages/monitor/monitor" });
  },

  openAttendance() {
    wx.navigateTo({ url: "/pages/attendance/attendance" });
  }
});
