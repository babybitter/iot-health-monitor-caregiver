const repository = require("../../services/repository");
const workStore = require("../../store/work-store");
const { formatTime, minutesSince } = require("../../utils/date");

const patientMap = patients => (patients || []).reduce((result, item) => {
  result[item.id] = item;
  return result;
}, {});

Page({
  data: {
    loading: true,
    error: "",
    networkOnline: true,
    clocking: false,
    greeting: "上午好",
    caregiver: {},
    shift: {},
    attendance: {},
    counts: {},
    priorityPatients: [],
    alerts: [],
    tasks: [],
    latestPatient: null,
    latestVitals: null
  },

  onLoad() {
    this.unsubscribe = workStore.subscribe(state => this.setData({ networkOnline: state.networkOnline }));
    this.setData({ networkOnline: workStore.getState().networkOnline, greeting: this.getGreeting() });
    this.loadDashboard();
  },

  onShow() {
    if (!this.data.loading) this.loadDashboard(true);
  },

  onUnload() {
    if (this.unsubscribe) this.unsubscribe();
  },

  onPullDownRefresh() {
    this.loadDashboard(true).finally(() => wx.stopPullDownRefresh());
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
      const patientsById = patientMap(dashboard.patients);
      const priorityPatients = dashboard.patients.slice(0, 3).map(item => Object.assign({}, item, {
        updateLabel: minutesSince(item.lastUpdate) < 1 ? "刚刚更新" : `${minutesSince(item.lastUpdate)}分钟前更新`
      }));
      const alerts = dashboard.alerts.map(item => Object.assign({}, item, {
        patientName: patientsById[item.patientId] ? patientsById[item.patientId].displayName : "服务对象",
        timeLabel: formatTime(item.occurredAt),
        levelText: item.level === "danger" ? "紧急" : "关注"
      }));
      const tasks = dashboard.tasks.map(item => Object.assign({}, item, {
        patientName: patientsById[item.patientId] ? patientsById[item.patientId].displayName : "服务对象",
        statusText: item.status === "processing" ? "进行中" : "待完成",
        priorityText: item.priority === "urgent" ? "优先" : item.priority === "high" ? "较高" : "常规"
      }));
      this.setData({
        loading: false,
        error: "",
        caregiver: dashboard.caregiver,
        shift: dashboard.shift,
        attendance: dashboard.attendance,
        counts: dashboard.counts,
        priorityPatients,
        alerts,
        tasks,
        latestPatient: priorityPatients[0] || null,
        latestVitals: priorityPatients[0] ? {
          heartRate: priorityPatients[0].vitals.heartRate,
          bloodOxygen: priorityPatients[0].vitals.bloodOxygen,
          deviceStatus: (priorityPatients[0].devices || []).some(item => item.status === "online") ? "设备在线" : "设备离线"
        } : null
      });
    } catch (error) {
      this.setData({ loading: false, error: error.message || "工作台加载失败" });
    }
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
        content: "请确认当班任务和交接事项已经处理。签退后本班次状态将结束。",
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

  openPatients() {
    wx.navigateTo({ url: "/pages/patients/patients" });
  },

  openTasks() {
    wx.switchTab({ url: "/pages/tasks/tasks" });
  },

  openTask(event) {
    wx.navigateTo({ url: `/pages/task-detail/task-detail?id=${event.currentTarget.dataset.id}` });
  },

  openMonitor(event) {
    const patientId = event.currentTarget.dataset.patientId;
    if (patientId) {
      repository.selectPatient(patientId);
      workStore.setState({ selectedPatientId: patientId });
    }
    wx.switchTab({ url: "/pages/monitor/monitor" });
  },

  openAttendance() {
    wx.navigateTo({ url: "/pages/attendance/attendance" });
  }
});
