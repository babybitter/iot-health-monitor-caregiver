const repository = require("../../services/repository");

Page({
  data: {
    taskId: "",
    loading: true,
    error: "",
    submitting: false,
    task: null
  },

  onLoad(options) {
    this.setData({ taskId: options.id || "" });
    this.loadTask();
  },

  async loadTask() {
    if (!this.data.taskId) {
      this.setData({ loading: false, error: "任务参数缺失" });
      return;
    }
    this.setData({ loading: true, error: "" });
    try {
      const task = await repository.getTask(this.data.taskId);
      this.setData({ loading: false, task: this.formatTask(task) });
    } catch (error) {
      this.setData({ loading: false, error: error.message || "任务加载失败" });
    }
  },

  formatTask(task) {
    return Object.assign({}, task, {
      statusText: task.status === "processing" ? "进行中" : task.status === "completed" ? "已完成" : "待完成",
      priorityText: task.priority === "urgent" ? "优先处理" : task.priority === "high" ? "较高优先级" : "常规任务",
      priorityType: task.priority === "urgent" ? "danger" : task.priority === "high" ? "warning" : "neutral"
    });
  },

  retryLoad() {
    this.loadTask();
  },

  startTask() {
    this.updateStatus("processing");
  },

  completeTask() {
    if (this.data.submitting) return;
    wx.showModal({
      title: "确认完成任务",
      content: "请确认任务要求已经执行并完成必要记录。",
      confirmText: "确认完成",
      success: result => {
        if (result.confirm) this.updateStatus("completed");
      }
    });
  },

  async updateStatus(status) {
    if (this.data.submitting || !this.data.task) return;
    this.setData({ submitting: true });
    try {
      const task = await repository.updateTask(this.data.task.id, status);
      const fullTask = Object.assign({}, this.data.task, task);
      this.setData({ submitting: false, task: this.formatTask(fullTask) });
      wx.showToast({ title: status === "completed" ? "任务已完成" : "任务已开始", icon: "success" });
    } catch (error) {
      this.setData({ submitting: false });
      wx.showToast({ title: error.message || "状态更新失败", icon: "none" });
    }
  },

  openPatientMonitor() {
    if (!this.data.task || !this.data.task.patientId) return;
    repository.selectPatient(this.data.task.patientId);
    const workStore = require("../../store/work-store");
    workStore.setState({ selectedPatientId: this.data.task.patientId });
    wx.switchTab({ url: "/pages/monitor/monitor" });
  },

  addRecord() {
    if (!this.data.task) return;
    wx.navigateTo({ url: `/pages/record-edit/record-edit?patientId=${this.data.task.patientId}&type=${encodeURIComponent(this.data.task.category)}` });
  }
});

