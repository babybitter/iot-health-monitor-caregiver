const repository = require("../../services/repository");
const workStore = require("../../store/work-store");
const { minutesSince } = require("../../utils/date");

Page({
  data: {
    loading: true,
    loadingMore: false,
    error: "",
    query: "",
    activeStatus: "all",
    filters: [
      { key: "all", label: "全部" },
      { key: "danger", label: "异常" },
      { key: "warning", label: "关注" },
      { key: "normal", label: "平稳" }
    ],
    patients: [],
    page: 1,
    pageSize: 5,
    total: 0,
    hasMore: false
  },

  onLoad() {
    this.loadPatients(true);
  },

  onPullDownRefresh() {
    this.loadPatients(true, true).finally(() => wx.stopPullDownRefresh());
  },

  formatPatient(item) {
    const minutes = minutesSince(item.lastUpdate);
    return Object.assign({}, item, {
      avatarText: item.displayName ? item.displayName.charAt(0) : "患",
      statusText: item.status === "danger" ? "异常" : item.status === "warning" ? "关注" : "平稳",
      updateLabel: minutes < 1 ? "刚刚更新" : `${minutes}分钟前更新`
    });
  },

  async loadPatients(reset, silent) {
    if (this.data.loadingMore) return;
    const page = reset ? 1 : this.data.page + 1;
    if (reset && !silent) this.setData({ loading: true, error: "" });
    if (!reset) this.setData({ loadingMore: true });
    try {
      const result = await repository.listPatients({
        query: this.data.query,
        status: this.data.activeStatus,
        page,
        pageSize: this.data.pageSize
      });
      const rows = result.rows.map(item => this.formatPatient(item));
      this.setData({
        loading: false,
        loadingMore: false,
        error: "",
        patients: reset ? rows : this.data.patients.concat(rows),
        page,
        total: result.total,
        hasMore: result.hasMore
      });
    } catch (error) {
      this.setData({ loading: false, loadingMore: false, error: error.message || "患者列表加载失败" });
    }
  },

  onQueryInput(event) {
    this.setData({ query: event.detail.value });
  },

  search() {
    this.loadPatients(true);
  },

  clearQuery() {
    this.setData({ query: "" });
    this.loadPatients(true);
  },

  selectFilter(event) {
    const activeStatus = event.currentTarget.dataset.key;
    if (!activeStatus || activeStatus === this.data.activeStatus) return;
    this.setData({ activeStatus });
    this.loadPatients(true);
  },

  retryLoad() {
    this.loadPatients(true);
  },

  loadMore() {
    if (this.data.hasMore && !this.data.loadingMore) this.loadPatients(false);
  },

  openMonitor(event) {
    const patientId = event.currentTarget.dataset.id;
    repository.selectPatient(patientId);
    workStore.setState({ selectedPatientId: patientId });
    wx.switchTab({ url: "/pages/monitor/monitor" });
  },

  addRecord(event) {
    wx.navigateTo({ url: `/pages/record-edit/record-edit?patientId=${event.currentTarget.dataset.id}` });
  }
});
