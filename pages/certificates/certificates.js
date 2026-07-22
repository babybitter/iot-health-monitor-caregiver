const repository = require("../../services/repository");

Page({
  data: { loading: true, error: "", certificates: [] },

  onLoad() {
    this.loadCertificates();
  },

  async loadCertificates() {
    this.setData({ loading: true, error: "" });
    try {
      const rows = await repository.listCertificates();
      this.setData({
        loading: false,
        certificates: rows.map(item => Object.assign({}, item, {
          statusText: item.status === "expiring" ? "即将到期" : item.status === "expired" ? "已过期" : "有效"
        }))
      });
    } catch (error) {
      this.setData({ loading: false, error: error.message || "证书加载失败" });
    }
  },

  retryLoad() {
    this.loadCertificates();
  }
});

