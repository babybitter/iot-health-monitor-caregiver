const realtime = require("../../services/realtime");
const workStore = require("../../store/work-store");
const config = require("../../config/index.js");
const { formatMetric, statusText } = require("../../utils/health");
const { formatDateTime, formatTime } = require("../../utils/date");

const metricOrder = ["heartRate", "breathing", "bloodOxygen", "bodyTemperature", "temperature", "humidity", "light", "pressure"];
const controlDefinitions = [
  { key: "light", name: "床旁灯光" },
  { key: "buzzer", name: "蜂鸣提醒" },
  { key: "humidifier", name: "加湿设备" },
  { key: "fan", name: "通风设备" }
];

Page({
  data: {
    loading: false,
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
    subject: config.careSubject,
    subjectStatus: "等待数据",
    subjectStatusType: "offline",
    vitalCards: [],
    alerts: [],
    infusion: {},
    infusionPercent: 0,
    infusionStatus: "normal",
    infusionStatusText: "等待数据",
    devices: [],
    controls: controlDefinitions.map(item => Object.assign({}, item, { enabled: false, feedbackReceived: false })),
    sendingControlKey: "",
    realtimeEnabled: realtime.isEnabled(),
    realtimeConnected: false,
    connectionError: "",
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
    hasHistory: false,
    historySummary: {},
    chartConfig: { lazyLoad: true }
  },

  chart: null,

  onLoad() {
    this.unsubscribeStore = workStore.subscribe(state => this.applyLiveState(state));
    this.applyLiveState(workStore.getState());
    this.reconnect(false);
  },

  onShow() {
    this.applyLiveState(workStore.getState());
  },

  onUnload() {
    if (this.unsubscribeStore) this.unsubscribeStore();
    if (this.chart) this.chart.dispose();
  },

  onPullDownRefresh() {
    this.refreshRealtime().finally(() => wx.stopPullDownRefresh());
  },

  applyLiveState(state) {
    const monitor = state.monitor;
    const vitalCards = metricOrder.map(type => {
      const metric = monitor.metrics[type];
      return Object.assign({}, formatMetric(type, metric.value), { statusLabel: statusText(metric.status), updatedAt: metric.updatedAt });
    });
    const alerts = monitor.alerts.map(item => Object.assign({}, item, {
      timeLabel: formatDateTime(item.occurredAt),
      levelText: item.level === "danger" ? "紧急" : "关注"
    }));
    const infusion = monitor.infusion;
    const hasInitialWeight = Number.isFinite(infusion.initialWeight) && infusion.initialWeight > 0;
    const hasRemainingWeight = Number.isFinite(infusion.remainingWeight);
    const infusionPercent = hasInitialWeight && hasRemainingWeight
      ? Math.max(0, Math.min(100, Number((infusion.remainingWeight / infusion.initialWeight * 100).toFixed(1))))
      : 0;
    let infusionStatus = "normal";
    let infusionStatusText = hasInitialWeight ? "输液监测中" : "等待初始重量";
    if (hasInitialWeight && infusionPercent <= 5) {
      infusionStatus = "danger";
      infusionStatusText = "余量不足";
    } else if (hasInitialWeight && infusionPercent <= 20) {
      infusionStatus = "warning";
      infusionStatusText = "余量偏低";
    }
    let subjectStatusType = "offline";
    let subjectStatus = "等待数据";
    if (monitor.lastUpdate) {
      subjectStatusType = alerts.some(item => item.level === "danger") ? "danger" : alerts.length ? "warning" : "normal";
      subjectStatus = subjectStatusType === "danger" ? "存在异常" : subjectStatusType === "warning" ? "需要关注" : "数据平稳";
    }
    const controlFeedback = monitor.device.controls || {};
    const controls = this.data.controls.map(item => Object.assign({}, item,
      controlFeedback[item.key] === undefined ? {} : { enabled: Boolean(controlFeedback[item.key]), feedbackReceived: true }
    ));
    this.setData({
      realtimeConnected: state.realtimeConnected,
      connectionError: state.connectionError,
      subjectStatus,
      subjectStatusType,
      vitalCards,
      alerts,
      infusion,
      infusionPercent,
      infusionStatus,
      infusionStatusText,
      infusionUpdateLabel: formatDateTime(infusion.updatedAt),
      lastUpdateLabel: formatDateTime(monitor.lastUpdate),
      devices: [{
        id: "current-monitor-device",
        name: config.careSubject.location,
        status: monitor.device.updatedAt ? monitor.device.status : "unknown",
        statusText: monitor.device.updatedAt ? (monitor.device.status === "online" ? "在线" : monitor.device.status === "standby" ? "待机" : "离线") : "等待反馈",
        updateLabel: monitor.device.updatedAt ? `反馈于 ${formatDateTime(monitor.device.updatedAt)}` : "等待设备状态反馈"
      }],
      controls
    });
    if (this.data.activeTab === "trend") this.loadHistory();
  },

  reconnect(showFeedback) {
    const app = getApp();
    if (!app || !app.connectRealtime) return Promise.resolve(false);
    return app.connectRealtime().then(connected => {
      if (showFeedback) wx.showToast({ title: connected ? "MQTT 已连接" : "连接仍不可用", icon: connected ? "success" : "none" });
      return connected;
    });
  },

  async refreshRealtime() {
    if (this.data.refreshing) return;
    this.setData({ refreshing: true });
    try {
      const connected = await this.reconnect(false);
      if (connected) realtime.subscribeConfiguredTopics();
      wx.showToast({ title: connected ? "已重新订阅主题" : "MQTT 连接不可用", icon: connected ? "success" : "none" });
    } finally {
      this.setData({ refreshing: false });
    }
  },

  retryConnection() {
    if (this.data.refreshing) return;
    this.setData({ refreshing: true });
    this.reconnect(true).finally(() => this.setData({ refreshing: false }));
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

  loadHistory() {
    const rows = workStore.getLiveHistory(this.data.selectedMetric, this.data.selectedRange);
    if (!rows.length) {
      this.setData({ historyLoading: false, hasHistory: false, historySummary: {} });
      return;
    }
    const values = rows.map(item => item.value).filter(Number.isFinite);
    this.historyRows = rows;
    this.setData({
      historyLoading: false,
      hasHistory: true,
      historySummary: {
        latest: values[values.length - 1],
        min: Math.min.apply(null, values),
        max: Math.max.apply(null, values),
        count: values.length
      }
    });
    setTimeout(() => this.renderChart(rows), 60);
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
      const chart = echarts.init(canvas, null, { width, height, devicePixelRatio: dpr });
      canvas.setChart(chart);
      chart.setOption(option, true);
      this.chart = chart;
      return chart;
    });
  },

  getChartOption(rows) {
    const metric = formatMetric(this.data.selectedMetric, 0);
    return {
      animation: false,
      grid: { left: 8, right: 10, top: 24, bottom: 8, containLabel: true },
      tooltip: { trigger: "axis", confine: true, valueFormatter: value => `${value}${metric.unit}` },
      xAxis: {
        type: "category",
        boundaryGap: false,
        data: rows.map(item => formatTime(item.time)),
        axisLine: { lineStyle: { color: "#dfe6ef" } },
        axisLabel: { color: "#7c8799", fontSize: 10, interval: Math.max(0, Math.floor(rows.length / 5) - 1) },
        axisTick: { show: false }
      },
      yAxis: { type: "value", scale: true, axisLabel: { color: "#7c8799", fontSize: 10 }, splitLine: { lineStyle: { color: "#edf1f5" } } },
      series: [{
        name: metric.label,
        type: "line",
        smooth: true,
        showSymbol: rows.length <= 12,
        symbolSize: 5,
        data: rows.map(item => item.value),
        lineStyle: { color: "#1769e0", width: 2 },
        itemStyle: { color: "#1769e0" },
        areaStyle: { color: "rgba(23, 105, 224, 0.10)" }
      }]
    };
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
        if (result.confirm) {
          this.setData({ submitting: true });
          const acknowledged = workStore.acknowledgeAlert(alertId);
          this.setData({ submitting: false });
          wx.showToast({ title: acknowledged ? "处理情况已记录" : "告警已更新", icon: acknowledged ? "success" : "none" });
        }
      }
    });
  },

  recordObservation() {
    wx.navigateTo({ url: `/pages/record-edit/record-edit?patientId=${config.careSubject.id}&type=${encodeURIComponent("异常观察")}` });
  },

  triggerInfusionAlert() {
    if (this.data.submitting) return;
    if (!this.data.realtimeConnected) {
      wx.showModal({ title: "实时控制不可用", content: "MQTT 当前未连接，无法向设备发送蜂鸣提醒。", showCancel: false });
      return;
    }
    wx.showModal({
      title: "触发设备提醒",
      content: "将向当前输液监测设备发送一次低余量蜂鸣提醒，请确认现场确有需要。",
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
      await realtime.publish(config.mqtt.weightDriveTopic, { action: "start", type: "low_liquid" });
      wx.showToast({ title: "设备提醒已发送", icon: "success" });
    } catch (error) {
      wx.showToast({ title: error.message || "发送失败", icon: "none" });
    } finally {
      this.setData({ submitting: false });
    }
  },

  async onDeviceControlChange(event) {
    const device = event.currentTarget.dataset.key;
    const enabled = Boolean(event.detail.value);
    if (this.data.sendingControlKey) return;
    const originalControls = this.data.controls.map(item => Object.assign({}, item));
    const controls = originalControls.map(item => item.key === device ? Object.assign({}, item, { enabled }) : item);
    this.setData({ controls, sendingControlKey: device });
    try {
      if (!this.data.realtimeConnected) throw new Error("MQTT 实时连接不可用");
      await realtime.publish(config.mqtt.publishTopic, { device, action: "toggle", value: enabled, timestamp: Date.now() });
      wx.showToast({ title: "设备指令已发送", icon: "success" });
      this.setData({ sendingControlKey: "" });
    } catch (error) {
      this.setData({ controls: originalControls, sendingControlKey: "" });
      wx.showToast({ title: error.message || "设备控制失败", icon: "none" });
    }
  }
});
