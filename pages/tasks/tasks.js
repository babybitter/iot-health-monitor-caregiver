const repository = require("../../services/repository");

Page({
  data: {
    loading: true,
    loadingMore: false,
    error: "",
    activeStatus: "all",
    filters: [
      { key: "all", label: "全部" },
      { key: "pending", label: "待完成" },
      { key: "processing", label: "进行中" },
      { key: "completed", label: "已完成" }
    ],
    tasks: [],
    page: 1,
    pageSize: 6,
    total: 0,
    hasMore: false
  },

  onLoad() {
    this.loadTasks(true);
  },

  onShow() {
    if (!this.data.loading && this.data.tasks.length) this.loadTasks(true, true);
  },

  onPullDownRefresh() {
    this.loadTasks(true, true).finally(() => wx.stopPullDownRefresh());
  },

  formatTask(item) {
    return Object.assign({}, item, {
      statusText: item.status === "processing" ? "进行中" : item.status === "completed" ? "已完成" : "待完成",
      priorityText: item.priority === "urgent" ? "优先处理" : item.priority === "high" ? "较高优先级" : "常规",
      priorityType: item.priority === "urgent" ? "danger" : item.priority === "high" ? "warning" : "neutral"
    });
  },

  async loadTasks(reset, silent) {
    if (this.data.loadingMore) return;
    const page = reset ? 1 : this.data.page + 1;
    if (reset && !silent) this.setData({ loading: true, error: "" });
    if (!reset) this.setData({ loadingMore: true });
    try {
      const result = await repository.listTasks({ status: this.data.activeStatus, page, pageSize: this.data.pageSize });
      const rows = result.rows.map(item => this.formatTask(item));
      this.setData({
        loading: false,
        loadingMore: false,
        error: "",
        tasks: reset ? rows : this.data.tasks.concat(rows),
        page,
        total: result.total,
        hasMore: result.hasMore
      });
    } catch (error) {
      this.setData({ loading: false, loadingMore: false, error: error.message || "任务加载失败" });
    }
  },

  selectFilter(event) {
    const activeStatus = event.currentTarget.dataset.key;
    if (!activeStatus || activeStatus === this.data.activeStatus) return;
    this.setData({ activeStatus, tasks: [], page: 1, total: 0, hasMore: false });
    this.loadTasks(true);
  },

  retryLoad() {
    this.loadTasks(true);
  },

  loadMore() {
    if (this.data.hasMore && !this.data.loadingMore) this.loadTasks(false);
  },

  openTask(event) {
    wx.navigateTo({ url: `/pages/task-detail/task-detail?id=${event.currentTarget.dataset.id}` });
  }
});

