const repository = require("../../services/repository");

Page({
  data: {
    loading: true,
    error: "",
    caregiver: {},
    counts: { patients: 0, completedTasks: 0, pendingTraining: 0, expiringCertificates: 0 },
    menuGroups: []
  },

  onLoad() {
    this.loadProfile();
  },

  onShow() {
    if (!this.data.loading) this.loadProfile(true);
  },

  onPullDownRefresh() {
    this.loadProfile(true).finally(() => wx.stopPullDownRefresh());
  },

  async loadProfile(silent) {
    if (!silent) this.setData({ loading: true, error: "" });
    try {
      const [patients, tasks, certificates, training] = await Promise.all([
        repository.listPatients({ page: 1, pageSize: 20 }),
        repository.listTasks({ status: "completed", page: 1, pageSize: 20 }),
        repository.listCertificates(),
        repository.listTraining()
      ]);
      const counts = {
        patients: patients.total,
        completedTasks: tasks.total,
        pendingTraining: training.filter(item => item.status === "pending").length,
        expiringCertificates: certificates.filter(item => item.status === "expiring").length
      };
      this.setData({
        loading: false,
        error: "",
        caregiver: repository.getCaregiverProfile(),
        counts,
        menuGroups: [
          { id: "work", items: [
            { key: "attendance", mark: "勤", title: "考勤记录", desc: "查看当前班次与历史记录", badge: "" },
            { key: "records", mark: "录", title: "照护记录", desc: "查看或新增工作记录", badge: "" }
          ] },
          { id: "growth", items: [
            { key: "certificates", mark: "证", title: "资质证书", desc: "查看证书编号和有效期", badge: counts.expiringCertificates ? `${counts.expiringCertificates}项临期` : "" },
            { key: "training", mark: "训", title: "培训与考核", desc: "查看待完成项目和历史结果", badge: counts.pendingTraining ? `${counts.pendingTraining}项待办` : "" }
          ] }
        ]
      });
    } catch (error) {
      this.setData({ loading: false, error: error.message || "个人信息加载失败" });
    }
  },

  retryLoad() {
    this.loadProfile();
  },

  openMenu(event) {
    const routes = {
      attendance: "/pages/attendance/attendance",
      records: "/pages/records/records",
      certificates: "/pages/certificates/certificates",
      training: "/pages/training/training"
    };
    const url = routes[event.currentTarget.dataset.key];
    if (url) wx.navigateTo({ url });
  }
});
