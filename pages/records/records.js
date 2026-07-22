const repository = require("../../services/repository");
const { formatDateTime } = require("../../utils/date");

Page({
  data: {
    loading: true,
    loadingMore: false,
    error: "",
    patients: [],
    patientNames: ["全部服务对象"],
    selectedIndex: 0,
    records: [],
    page: 1,
    pageSize: 6,
    total: 0,
    hasMore: false
  },

  onLoad() {
    this.loadInitial();
  },

  onShow() {
    if (this.hasLoaded) this.loadRecords(true, true);
  },

  onPullDownRefresh() {
    this.loadRecords(true, true).finally(() => wx.stopPullDownRefresh());
  },

  async loadInitial() {
    this.setData({ loading: true, error: "" });
    try {
      const result = await repository.listPatients({ page: 1, pageSize: 20 });
      this.setData({ patients: result.rows, patientNames: ["全部服务对象"].concat(result.rows.map(item => `${item.displayName} · ${item.bed}`)) });
      await this.loadRecords(true, true);
    } catch (error) {
      this.setData({ loading: false, error: error.message || "照护记录加载失败" });
    }
  },

  async loadRecords(reset, silent) {
    if (this.data.loadingMore) return;
    const page = reset ? 1 : this.data.page + 1;
    if (reset && !silent) this.setData({ loading: true, error: "" });
    if (!reset) this.setData({ loadingMore: true });
    try {
      const patientId = this.data.selectedIndex > 0 ? this.data.patients[this.data.selectedIndex - 1].id : "";
      const result = await repository.listRecords({ patientId, page, pageSize: this.data.pageSize });
      const rows = result.rows.map(item => Object.assign({}, item, { timeLabel: formatDateTime(item.createdAt) }));
      this.setData({
        loading: false,
        loadingMore: false,
        error: "",
        records: reset ? rows : this.data.records.concat(rows),
        page,
        total: result.total,
        hasMore: result.hasMore
      });
      this.hasLoaded = true;
    } catch (error) {
      this.setData({ loading: false, loadingMore: false, error: error.message || "照护记录加载失败" });
    }
  },

  onPatientChange(event) {
    this.setData({ selectedIndex: Number(event.detail.value) });
    this.loadRecords(true);
  },

  retryLoad() {
    this.loadInitial();
  },

  loadMore() {
    if (this.data.hasMore && !this.data.loadingMore) this.loadRecords(false);
  },

  addRecord() {
    const patientId = this.data.selectedIndex > 0 ? this.data.patients[this.data.selectedIndex - 1].id : "";
    wx.navigateTo({ url: `/pages/record-edit/record-edit${patientId ? `?patientId=${patientId}` : ""}` });
  }
});
