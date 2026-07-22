const repository = require("../../services/repository");

Page({
  data: {
    loading: true,
    error: "",
    submitting: false,
    formError: "",
    patients: [],
    patientNames: [],
    selectedPatientIndex: 0,
    types: ["日常照护", "生命体征", "输液巡视", "异常观察", "交接记录", "生活照护"],
    selectedTypeIndex: 0,
    content: "",
    result: "",
    contentCount: 0,
    resultCount: 0
  },

  onLoad(options) {
    this.initialPatientId = options.patientId || "";
    try {
      this.initialType = options.type ? decodeURIComponent(options.type) : "";
    } catch (error) {
      this.initialType = options.type || "";
    }
    this.loadPatients();
  },

  async loadPatients() {
    this.setData({ loading: true, error: "" });
    try {
      const result = await repository.listPatients({ page: 1, pageSize: 20 });
      const patients = result.rows;
      const selectedPatientIndex = Math.max(0, patients.findIndex(item => item.id === this.initialPatientId));
      const selectedTypeIndex = Math.max(0, this.data.types.indexOf(this.initialType));
      this.setData({
        loading: false,
        patients,
        patientNames: patients.map(item => `${item.displayName} · ${item.bed}`),
        selectedPatientIndex,
        selectedTypeIndex
      });
    } catch (error) {
      this.setData({ loading: false, error: error.message || "服务对象加载失败" });
    }
  },

  retryLoad() {
    this.loadPatients();
  },

  onPatientChange(event) {
    this.setData({ selectedPatientIndex: Number(event.detail.value), formError: "" });
  },

  onTypeChange(event) {
    this.setData({ selectedTypeIndex: Number(event.detail.value), formError: "" });
  },

  onContentInput(event) {
    const content = event.detail.value;
    this.setData({ content, contentCount: content.length, formError: "" });
  },

  onResultInput(event) {
    const result = event.detail.value;
    this.setData({ result, resultCount: result.length, formError: "" });
  },

  validate() {
    if (!this.data.patients.length) return "当前没有可记录的服务对象";
    if (!this.data.content.trim()) return "请填写照护事项";
    if (!this.data.result.trim()) return "请填写处理结果";
    return "";
  },

  async submit() {
    if (this.data.submitting) return;
    const formError = this.validate();
    if (formError) {
      this.setData({ formError });
      wx.showToast({ title: formError, icon: "none" });
      return;
    }
    this.setData({ submitting: true, formError: "" });
    const patient = this.data.patients[this.data.selectedPatientIndex];
    try {
      await repository.createRecord({
        patientId: patient.id,
        type: this.data.types[this.data.selectedTypeIndex],
        content: this.data.content,
        result: this.data.result
      });
      this.setData({ submitting: false });
      wx.showToast({ title: "照护记录已保存", icon: "success", duration: 1200 });
      setTimeout(() => wx.navigateBack(), 1200);
    } catch (error) {
      this.setData({ submitting: false, formError: error.message || "保存失败" });
      wx.showToast({ title: error.message || "保存失败", icon: "none" });
    }
  },

  cancel() {
    const hasContent = this.data.content.trim() || this.data.result.trim();
    if (!hasContent) {
      wx.navigateBack();
      return;
    }
    wx.showModal({
      title: "放弃本次填写",
      content: "尚未保存的内容将不会保留。",
      confirmText: "放弃",
      confirmColor: "#c43a47",
      success: result => {
        if (result.confirm) wx.navigateBack();
      }
    });
  }
});

