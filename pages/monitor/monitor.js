const repository = require("../../services/repository");
const realtime = require("../../services/realtime");
const workStore = require("../../store/work-store");
const config = require("../../config/index.js");
const { formatMetric, statusText } = require("../../utils/health");
const { formatDateTime, formatTime, minutesSince } = require("../../utils/date");

const metricOrder = ["heartRate", "breathing", "bloodOxygen", "bodyTemperature", "temperature", "humidity", "light", "pressure"];
const statusLabel = status => ({ danger: "异常", warning: "关注", normal: "平稳", offline: "离线" }[status] || "暂无");

Page({
  data: {
    loading: true,
    error: "",
    refreshing: false,
    submitting: false,
    activeTab: "vitals",
    tabs: [
      { key: "vitals", label: "生命体征" },
      { key: "infusion", label: "输液" },
      { key: "trend", label: "趋势" },
      { key: "device", label: "设备" }
    ],
    patients: [],
    patientNames: [],
    selectedIndex: 0,
    selectedPatient: null,
    vitalCards: [],
    alerts: [],
    infusion: null,
    infusionPercent: 0,
    infusionStatus: "normal",
    infusionStatusText: "未输液",
    devices: [],
    controls: [],
    sendingControlKey: "",
    mockMode: config.dataMode === "mock",
    realtimeEnabled: false,
    realtimeConnected: false,
    lastUpdateLabel: "--",
    infusionUpdateLabel: "--",
    metricOptions: [
      { key: "heartRate", label: "心率" },
      { key: "breathing", label: "呼吸" },
      { key: "bloodOxygen", label: "血氧" },
      { key: "bodyTemperature", label: "体温" },
      { key: "temperature", label: "室温" },
      { key: "humidity", label: "湿度" },
      { key: "light", label: "光照" },
      { key: "pressure", label: "气压" }
    ],
    selectedMetric: "heartRate",
    selectedMetricLabel: "心率",
    ranges: [
      { key: "2h", label: "2小时" },
      { key: "6h", label: "6小时" },
      { key: "24h", label: "24小时" }
    ],
    selectedRange: "2h",
    historyLoading: false,
    historyError: "",
    hasHistory: false,
    historySummary: {},
    chartConfig: { lazyLoad: true }
  },

  chart: null,

  onLoad() {
    this.setData({ realtimeEnabled: realtime.isEnabled() });
    this.unsubscribeStore = workStore.subscribe(state => {
      if (state.selectedPatientId && this.data.selectedPatient && state.selectedPatientId !== this.data.selectedPatient.id) {
        this.selectPatientById(state.selectedPatientId);
      }
    });
    this.unsubscribeRealtime = realtime.on(event => this.handleRealtimeEvent(event));
    this.loadInitialData();
  },

  onShow() {
    const selectedPatientId = workStore.getState().selectedPatientId || repository.getSelectedPatientId();
    if (this.data.selectedPatient && selectedPatientId !== this.data.selectedPatient.id) this.selectPatientById(selectedPatientId);
  },

  onUnload() {
    if (this.unsubscribeStore) this.unsubscribeStore();
    if (this.unsubscribeRealtime) this.unsubscribeRealtime();
    if (this.chart) this.chart.dispose();
    realtime.disconnect();
  },

  onPullDownRefresh() {
    this.refreshSnapshot().finally(() => wx.stopPullDownRefresh());
  },

  async loadInitialData() {
    this.setData({ loading: true, error: "" });
    try {
      const result = await repository.listPatients({ page: 1, pageSize: 20 });
      const patients = result.rows;
      if (!patients.length) {
        this.setData({ loading: false, patients: [], error: "" });
        return;
      }
      const requestedId = workStore.getState().selectedPatientId || repository.getSelectedPatientId();
      const selectedIndex = Math.max(0, patients.findIndex(item => item.id === requestedId));
      this.setData({ patients, patientNames: patients.map(item => `${item.displayName} · ${item.bed}`), selectedIndex });
      await this.loadSnapshot(patients[selectedIndex].id);
      this.connectRealtime();
    } catch (error) {
      this.setData({ loading: false, error: error.message || "监控数据加载失败" });
    }
  },

  async connectRealtime() {
    if (!realtime.isEnabled()) return;
    try {
      await realtime.connect();
      realtime.subscribeSelectedPatient();
      this.setData({ realtimeConnected: true });
      workStore.setState({ realtimeConnected: true });
    } catch (error) {
      this.setData({ realtimeConnected: false });
      workStore.setState({ realtimeConnected: false });
    }
  },

  async loadSnapshot(patientId, silent) {
    if (!silent) this.setData({ loading: true, error: "" });
    const snapshot = await repository.getMonitorSnapshot(patientId);
    const alerts = await repository.listAlerts(patientId);
    const vitalCards = metricOrder.map(type => formatMetric(type, snapshot.vitals[type])).map(item => Object.assign({}, item, { statusLabel: statusText(item.status) }));
    const infusion = snapshot.infusion || {};
    const infusionPercent = infusion.initialWeight > 0
      ? Math.max(0, Math.min(100, Math.round(infusion.remainingWeight / infusion.initialWeight * 100)))
      : 0;
    let infusionStatus = "normal";
    let infusionStatusText = infusion.initialWeight > 0 ? "输液中" : "未输液";
    if (infusion.initialWeight > 0 && infusion.remainingWeight <= infusion.threshold) {
      infusionStatus = "danger";
      infusionStatusText = "余量不足";
    } else if (infusion.initialWeight > 0 && infusionPercent <= 20) {
      infusionStatus = "warning";
      infusionStatusText = "余量偏低";
    }
    const processedAlerts = alerts.filter(item => item.status === "pending").map(item => Object.assign({}, item, {
      timeLabel: formatDateTime(item.occurredAt),
      levelText: item.level === "danger" ? "紧急" : "关注"
    }));
    repository.selectPatient(snapshot.id);
    workStore.setState({ selectedPatientId: snapshot.id });
    this.setData({
      loading: false,
      refreshing: false,
      error: "",
      selectedPatient: Object.assign({}, snapshot, { statusLabel: statusLabel(snapshot.status) }),
      vitalCards,
      alerts: processedAlerts,
      infusion,
      infusionPercent,
      infusionStatus,
      infusionStatusText,
      devices: (snapshot.devices || []).map(item => Object.assign({}, item, {
        statusText: item.status === "online" ? "在线" : item.status === "standby" ? "待机" : "离线",
        updateLabel: minutesSince(item.updatedAt) < 1 ? "刚刚更新" : `${minutesSince(item.updatedAt)}分钟前更新`
      })),
      controls: snapshot.controls || [],
      infusionUpdateLabel: formatDateTime(infusion.updatedAt),
      lastUpdateLabel: formatDateTime(snapshot.lastUpdate)
    });
    if (this.data.activeTab === "trend") this.loadHistory();
  },

  async refreshSnapshot() {
    if (!this.data.selectedPatient || this.data.refreshing) return;
    this.setData({ refreshing: true });
    try {
      await this.loadSnapshot(this.data.selectedPatient.id, true);
      wx.showToast({ title: "监控数据已刷新", icon: "success" });
    } catch (error) {
      this.setData({ refreshing: false });
      wx.showToast({ title: error.message || "刷新失败", icon: "none" });
    }
  },

  retryLoad() {
    this.loadInitialData();
  },

  onPatientChange(event) {
    const selectedIndex = Number(event.detail.value);
    const patient = this.data.patients[selectedIndex];
    if (!patient || (this.data.selectedPatient && patient.id === this.data.selectedPatient.id)) return;
    this.setData({ selectedIndex, historyError: "", hasHistory: false });
    this.loadSnapshot(patient.id).catch(error => this.setData({ loading: false, error: error.message || "患者监控数据加载失败" }));
  },

  selectPatientById(patientId) {
    const selectedIndex = this.data.patients.findIndex(item => item.id === patientId);
    if (selectedIndex < 0) return;
    this.setData({ selectedIndex });
    this.loadSnapshot(patientId).catch(error => this.setData({ loading: false, error: error.message || "患者监控数据加载失败" }));
  },

  switchTab(event) {
    const activeTab = event.currentTarget.dataset.key;
    if (!activeTab || activeTab === this.data.activeTab) return;
    if (this.data.activeTab === "trend" && activeTab !== "trend" && this.chart) {
      this.chart.dispose();
      this.chart = null;
    }
    this.setData({ activeTab });
    if (activeTab === "trend") this.loadHistory();
  },

  selectMetric(event) {
    const selectedMetric = event.currentTarget.dataset.key;
    const option = this.data.metricOptions.find(item => item.key === selectedMetric);
    if (!option || selectedMetric === this.data.selectedMetric) return;
    this.setData({ selectedMetric, selectedMetricLabel: option.label, hasHistory: false });
    this.loadHistory();
  },

  selectRange(event) {
    const selectedRange = event.currentTarget.dataset.key;
    if (!selectedRange || selectedRange === this.data.selectedRange) return;
    this.setData({ selectedRange, hasHistory: false });
    this.loadHistory();
  },

  async loadHistory() {
    if (!this.data.selectedPatient || this.data.historyLoading) return;
    this.setData({ historyLoading: true, historyError: "" });
    try {
      const rows = await repository.getHistory(this.data.selectedPatient.id, this.data.selectedMetric, this.data.selectedRange);
      if (!rows.length) {
        this.setData({ historyLoading: false, hasHistory: false, historyError: "" });
        return;
      }
      const values = rows.map(item => item.value).filter(Number.isFinite);
      const historySummary = {
        latest: values[values.length - 1],
        min: Math.min.apply(null, values),
        max: Math.max.apply(null, values),
        count: values.length
      };
      this.historyRows = rows;
      this.setData({ historyLoading: false, hasHistory: true, historySummary });
      setTimeout(() => this.renderChart(rows), 60);
    } catch (error) {
      this.setData({ historyLoading: false, hasHistory: false, historyError: error.message || "趋势数据加载失败" });
    }
  },

  renderChart(rows) {
    const component = this.selectComponent("#trend-chart");
    if (!component) return;
    const option = this.getChartOption(rows);
    if (this.chart) {
      this.chart.setOption(option, true);
      this.chart.resize();
      return;
    }
    component.init((canvas, width, height, dpr) => {
      const echarts = require("../../ec-canvas/echarts");
      const chart = echarts.init(canvas, null, { width: Math.max(width, 280), height: Math.max(height, 220), devicePixelRatio: dpr });
      canvas.setChart(chart);
      chart.setOption(option, true);
      this.chart = chart;
      return chart;
    });
  },

  getChartOption(rows) {
    const metric = formatMetric(this.data.selectedMetric, 0);
    const values = rows.map(item => item.value);
    return {
      animation: false,
      grid: { left: 10, right: 12, top: 24, bottom: 10, containLabel: true },
      tooltip: { trigger: "axis", confine: true, valueFormatter: value => `${value}${metric.unit}` },
      xAxis: {
        type: "category",
        boundaryGap: false,
        data: rows.map(item => formatTime(item.time)),
        axisLine: { lineStyle: { color: "#dfe6ef" } },
        axisLabel: { color: "#7c8799", fontSize: 10, interval: Math.max(0, Math.floor(rows.length / 5) - 1) },
        axisTick: { show: false }
      },
      yAxis: {
        type: "value",
        scale: true,
        axisLabel: { color: "#7c8799", fontSize: 10 },
        splitLine: { lineStyle: { color: "#edf1f5" } }
      },
      series: [{
        name: metric.label,
        type: "line",
        smooth: true,
        showSymbol: rows.length <= 12,
        symbolSize: 5,
        data: values,
        lineStyle: { color: "#1769e0", width: 2 },
        itemStyle: { color: "#1769e0" },
        areaStyle: { color: "rgba(23, 105, 224, 0.10)" }
      }]
    };
  },

  retryHistory() {
    this.loadHistory();
  },

  handleAlert(event) {
    if (this.data.submitting) return;
    const alertId = event.currentTarget.dataset.id;
    const alert = this.data.alerts.find(item => item.id === alertId);
    if (!alert) return;
    wx.showModal({
      title: "确认处理情况",
      content: `${alert.title}\n\n请在完成现场核对后确认。此操作只记录已查看，不代表医疗诊断。`,
      confirmText: "已核对",
      success: result => {
        if (result.confirm) this.submitAlert(alertId);
      }
    });
  },

  async submitAlert(alertId) {
    if (this.data.submitting) return;
    this.setData({ submitting: true });
    try {
      await repository.acknowledgeAlert(alertId, "已完成现场核对");
      this.setData({ submitting: false, alerts: this.data.alerts.filter(item => item.id !== alertId) });
      wx.showToast({ title: "处理情况已记录", icon: "success" });
    } catch (error) {
      this.setData({ submitting: false });
      wx.showToast({ title: error.message || "记录失败", icon: "none" });
    }
  },

  recordObservation() {
    if (!this.data.selectedPatient) return;
    wx.navigateTo({ url: `/pages/record-edit/record-edit?patientId=${this.data.selectedPatient.id}&type=${encodeURIComponent("异常观察")}` });
  },

  triggerInfusionAlert() {
    if (!this.data.selectedPatient || this.data.submitting) return;
    if (!realtime.isEnabled() || !this.data.realtimeConnected) {
      wx.showModal({
        title: "实时控制不可用",
        content: "当前未配置 MQTT 实时连接，无法向设备发送蜂鸣提醒。请先在本地配置文件中完成连接设置。",
        showCancel: false
      });
      return;
    }
    wx.showModal({
      title: "触发设备提醒",
      content: `将向${this.data.selectedPatient.displayName}床旁输液设备发送一次蜂鸣提醒，请确认现场确有需要。`,
      confirmText: "确认发送",
      confirmColor: "#c43a47",
      success: result => {
        if (result.confirm) this.sendInfusionAlert();
      }
    });
  },

  async sendInfusionAlert() {
    this.setData({ submitting: true });
    try {
      await realtime.publish(`${config.mqtt.topicPrefix}/monitor/weight-drive`, {
        action: "start",
        type: "low_liquid",
        patientId: this.data.selectedPatient.id,
        timestamp: Date.now()
      });
      this.setData({ submitting: false });
      wx.showToast({ title: "设备提醒已发送", icon: "success" });
    } catch (error) {
      this.setData({ submitting: false });
      wx.showToast({ title: error.message || "发送失败", icon: "none" });
    }
  },

  async onDeviceControlChange(event) {
    const device = event.currentTarget.dataset.key;
    const enabled = Boolean(event.detail.value);
    if (!this.data.selectedPatient || this.data.sendingControlKey) return;
    const originalControls = this.data.controls.map(item => Object.assign({}, item));
    const controls = originalControls.map(item => item.key === device ? Object.assign({}, item, { enabled }) : item);
    this.setData({ controls, sendingControlKey: device });
    try {
      if (this.data.mockMode) {
        await repository.updateDeviceControl(this.data.selectedPatient.id, device, enabled);
        wx.showToast({ title: "演示状态已更新", icon: "success" });
      } else {
        if (!this.data.realtimeConnected) throw new Error("实时连接不可用");
        await realtime.publish(`${config.mqtt.topicPrefix}/control/device`, {
          device,
          action: "toggle",
          value: enabled,
          patientId: this.data.selectedPatient.id,
          timestamp: Date.now()
        });
        wx.showToast({ title: "设备指令已发送", icon: "success" });
      }
      this.setData({ sendingControlKey: "" });
    } catch (error) {
      this.setData({ controls: originalControls, sendingControlKey: "" });
      wx.showToast({ title: error.message || "设备控制失败", icon: "none" });
    }
  },

  handleRealtimeEvent(event) {
    if (event.type === "connection") {
      this.setData({ realtimeConnected: event.connected });
      return;
    }
    if (event.type !== "message" || !this.data.selectedPatient) return;
    const topicMap = {
      heart_rate: "heartRate",
      breathing: "breathing",
      blood_oxygen: "bloodOxygen",
      temperature: "bodyTemperature"
    };
    const suffix = event.topic.split("/").pop();
    const type = topicMap[suffix];
    if (!type) return;
    const value = typeof event.payload === "object" ? event.payload.value : event.payload;
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return;
    const snapshot = Object.assign({}, this.data.selectedPatient, {
      vitals: Object.assign({}, this.data.selectedPatient.vitals, { [type]: numeric }),
      lastUpdate: new Date().toISOString()
    });
    const vitalCards = metricOrder.map(metricType => formatMetric(metricType, snapshot.vitals[metricType])).map(item => Object.assign({}, item, { statusLabel: statusText(item.status) }));
    this.setData({ selectedPatient: snapshot, vitalCards, lastUpdateLabel: formatDateTime(snapshot.lastUpdate) });
  }
});
