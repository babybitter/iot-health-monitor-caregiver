const repository = require("../../services/repository");

Page({
  data: { loading: true, error: "", activeStatus: "pending", items: [], allItems: [] },

  onLoad() {
    this.loadTraining();
  },

  async loadTraining() {
    this.setData({ loading: true, error: "" });
    try {
      const allItems = await repository.listTraining();
      this.setData({ loading: false, allItems }, () => this.applyFilter());
    } catch (error) {
      this.setData({ loading: false, error: error.message || "培训信息加载失败" });
    }
  },

  selectStatus(event) {
    const activeStatus = event.currentTarget.dataset.status;
    if (activeStatus === this.data.activeStatus) return;
    this.setData({ activeStatus }, () => this.applyFilter());
  },

  applyFilter() {
    this.setData({ items: this.data.allItems.filter(item => item.status === this.data.activeStatus) });
  },

  retryLoad() {
    this.loadTraining();
  },

  showSchedule(event) {
    const item = this.data.allItems.find(row => row.id === event.currentTarget.dataset.id);
    if (!item) return;
    wx.showModal({
      title: item.title,
      content: `${item.type}时长：${item.duration}\n完成期限：${item.deadline}\n\n当前版本仅展示安排，请按机构通知参加培训或考核。`,
      showCancel: false,
      confirmText: "知道了"
    });
  }
});

