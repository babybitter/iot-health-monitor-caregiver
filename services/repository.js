const config = require("../config/index.js");
const mock = require("../mocks/data");
const request = require("./request");
const storage = require("../utils/storage");
const { evaluateMetric, severityRank } = require("../utils/health");

const KEYS = {
  selectedPatient: "caregiver_selected_patient",
  attendance: "caregiver_attendance",
  tasks: "caregiver_tasks",
  alerts: "caregiver_alerts",
  records: "caregiver_records",
  deviceControls: "caregiver_device_controls"
};

const clone = value => JSON.parse(JSON.stringify(value));
const delay = (value, duration) => new Promise(resolve => setTimeout(() => resolve(clone(value)), duration || 180));
const getPersisted = (key, fallback) => storage.read(key, clone(fallback));

const patientById = patientId => mock.patients.find(item => item.id === patientId) || mock.patients[0];

const firstDefined = (data, fields) => {
  if (!data) return undefined;
  const field = fields.find(name => data[name] !== undefined && data[name] !== null);
  return field ? data[field] : undefined;
};

const normalizeRemoteVitals = data => ({
  heartRate: firstDefined(data, ["heart_rate", "heartRate"]),
  breathing: firstDefined(data, ["breathing_rate", "breathing"]),
  bloodOxygen: firstDefined(data, ["blood_oxygen", "spo2", "bloodOxygen"]),
  bodyTemperature: firstDefined(data, ["body_temperature", "bodyTemperature"]),
  temperature: firstDefined(data, ["temperature", "temp"]),
  humidity: firstDefined(data, ["humidity", "humi"]),
  light: firstDefined(data, ["light", "light_intensity"]),
  pressure: firstDefined(data, ["pressure"])
});

const isRemote = () => config.dataMode === "remote";

const repository = {
  getCaregiverProfile() {
    return clone(mock.caregiver);
  },

  getSelectedPatientId() {
    return storage.read(KEYS.selectedPatient, mock.patients[0].id);
  },

  selectPatient(patientId) {
    const patient = patientById(patientId);
    storage.write(KEYS.selectedPatient, patient.id);
    return clone(patient);
  },

  async getDashboard() {
    const taskList = getPersisted(KEYS.tasks, mock.tasks);
    const alertList = getPersisted(KEYS.alerts, mock.alerts);
    const attendance = getPersisted(KEYS.attendance, mock.attendance);
    const patients = clone(mock.patients).sort((left, right) => {
      const levelDiff = severityRank(right.status) - severityRank(left.status);
      return levelDiff || right.alertCount - left.alertCount;
    });
    return delay({
      caregiver: mock.caregiver,
      shift: mock.caregiver.shift,
      attendance,
      patients,
      alerts: alertList.filter(item => item.status === "pending").slice(0, 3),
      tasks: taskList.filter(item => item.status !== "completed").slice(0, 4),
      counts: {
        patients: patients.length,
        alerts: alertList.filter(item => item.status === "pending").length,
        pendingTasks: taskList.filter(item => item.status !== "completed").length,
        completedTasks: taskList.filter(item => item.status === "completed").length
      }
    });
  },

  async listPatients(options) {
    const settings = options || {};
    const query = String(settings.query || "").trim().toLowerCase();
    const status = settings.status || "all";
    const page = Math.max(1, Number(settings.page) || 1);
    const pageSize = Math.max(1, Math.min(20, Number(settings.pageSize) || 6));
    let rows = clone(mock.patients);
    if (query) {
      rows = rows.filter(item => [item.displayName, item.bed, item.room, item.id].some(value => String(value).toLowerCase().includes(query)));
    }
    if (status !== "all") rows = rows.filter(item => item.status === status);
    rows.sort((left, right) => severityRank(right.status) - severityRank(left.status));
    const start = (page - 1) * pageSize;
    return delay({ rows: rows.slice(start, start + pageSize), total: rows.length, page, pageSize, hasMore: start + pageSize < rows.length });
  },

  async getPatient(patientId) {
    return delay(patientById(patientId));
  },

  async getMonitorSnapshot(patientId) {
    const patient = clone(patientById(patientId));
    const controlState = getPersisted(KEYS.deviceControls, {});
    const currentControls = controlState[patient.id] || { light: false, humidifier: false, fan: false };
    patient.controls = [
      { key: "light", name: "床旁灯光", enabled: Boolean(currentControls.light) },
      { key: "humidifier", name: "加湿设备", enabled: Boolean(currentControls.humidifier) },
      { key: "fan", name: "通风设备", enabled: Boolean(currentControls.fan) }
    ];
    if (isRemote()) {
      const latest = await request.get(`/api/latest/${encodeURIComponent(patient.deviceId)}`);
      const remoteVitals = normalizeRemoteVitals(latest || {});
      patient.vitals = {};
      Object.keys(remoteVitals).forEach(key => {
        if (remoteVitals[key] !== undefined && remoteVitals[key] !== null) patient.vitals[key] = remoteVitals[key];
      });
      patient.lastUpdate = latest && (latest.created_at || latest.timestamp) || new Date().toISOString();
      patient.infusion = {
        initialWeight: Number(firstDefined(latest, ["weight_begin", "initial_weight"])) || 0,
        remainingWeight: Number(firstDefined(latest, ["weight", "remaining_weight"])) || 0,
        speed: Number(firstDefined(latest, ["infusion_speed", "speed"])) || 0,
        threshold: Number(firstDefined(latest, ["weight_threshold", "threshold"])) || 0,
        updatedAt: patient.lastUpdate
      };
      patient.devices = [{ id: `api-${patient.deviceId}`, name: "健康监测数据服务", status: "online", updatedAt: patient.lastUpdate }];
    }
    const vitalStatuses = Object.keys(patient.vitals).map(type => evaluateMetric(type, patient.vitals[type]));
    const infusionDanger = patient.infusion.initialWeight > 0 && patient.infusion.remainingWeight <= patient.infusion.threshold;
    if (vitalStatuses.includes("danger") || infusionDanger) patient.status = "danger";
    else if (vitalStatuses.includes("warning")) patient.status = "warning";
    return delay(patient, 120);
  },

  async getHistory(patientId, metric, range) {
    const patient = patientById(patientId);
    const pointsByRange = { "2h": 12, "6h": 18, "24h": 24 };
    const limit = pointsByRange[range] || 12;
    if (!isRemote()) return delay(mock.buildHistory(patient.id, metric, limit), 220);

    const rows = await request.get(`/api/history/${encodeURIComponent(patient.deviceId)}`, { limit, page: 1 });
    const remoteRows = Array.isArray(rows) ? rows.slice().reverse() : [];
    const fieldMap = {
      heartRate: ["heart_rate", "heartRate"],
      breathing: ["breathing_rate", "breathing"],
      bloodOxygen: ["blood_oxygen", "spo2", "bloodOxygen"],
      bodyTemperature: ["body_temperature", "bodyTemperature"],
      temperature: ["temperature", "temp"],
      humidity: ["humidity", "humi"],
      light: ["light", "light_intensity"],
      pressure: ["pressure"]
    };
    const fields = fieldMap[metric] || [metric];
    return remoteRows.map(item => {
      const field = fields.find(name => item[name] !== undefined && item[name] !== null);
      return { time: item.created_at || item.timestamp, value: field ? Number(item[field]) : null };
    }).filter(item => Number.isFinite(item.value));
  },

  async listAlerts(patientId) {
    const rows = getPersisted(KEYS.alerts, mock.alerts)
      .filter(item => !patientId || item.patientId === patientId)
      .sort((left, right) => severityRank(right.level) - severityRank(left.level));
    return delay(rows);
  },

  async acknowledgeAlert(alertId, note) {
    const rows = getPersisted(KEYS.alerts, mock.alerts);
    const index = rows.findIndex(item => item.id === alertId);
    if (index < 0) throw new Error("未找到需要处理的告警");
    rows[index] = Object.assign({}, rows[index], {
      status: "acknowledged",
      handledAt: new Date().toISOString(),
      handleNote: String(note || "已查看并核对").trim()
    });
    if (!storage.write(KEYS.alerts, rows)) throw new Error("本地记录保存失败");
    return delay(rows[index], 120);
  },

  async updateDeviceControl(patientId, device, enabled) {
    if (!mock.patients.some(item => item.id === patientId)) throw new Error("服务对象不存在");
    if (!["light", "humidifier", "fan"].includes(device)) throw new Error("设备类型无效");
    const controlState = getPersisted(KEYS.deviceControls, {});
    controlState[patientId] = Object.assign({}, controlState[patientId] || {}, { [device]: Boolean(enabled) });
    if (!storage.write(KEYS.deviceControls, controlState)) throw new Error("设备演示状态保存失败");
    return delay({ patientId, device, enabled: Boolean(enabled) }, 120);
  },

  async listTasks(options) {
    const settings = options || {};
    const status = settings.status || "all";
    const page = Math.max(1, Number(settings.page) || 1);
    const pageSize = Math.max(1, Math.min(20, Number(settings.pageSize) || 6));
    let rows = getPersisted(KEYS.tasks, mock.tasks);
    if (status !== "all") rows = rows.filter(item => item.status === status);
    rows = rows.slice().sort((left, right) => left.scheduledTime.localeCompare(right.scheduledTime));
    const start = (page - 1) * pageSize;
    return delay({ rows: rows.slice(start, start + pageSize), total: rows.length, page, pageSize, hasMore: start + pageSize < rows.length });
  },

  async getTask(taskId) {
    const task = getPersisted(KEYS.tasks, mock.tasks).find(item => item.id === taskId);
    if (!task) throw new Error("任务不存在或已被移除");
    return delay(Object.assign({}, task, { patient: patientById(task.patientId) }));
  },

  async updateTask(taskId, status) {
    if (!["pending", "processing", "completed"].includes(status)) throw new Error("任务状态无效");
    const rows = getPersisted(KEYS.tasks, mock.tasks);
    const index = rows.findIndex(item => item.id === taskId);
    if (index < 0) throw new Error("任务不存在或已被移除");
    rows[index] = Object.assign({}, rows[index], {
      status,
      updatedAt: new Date().toISOString(),
      completedTime: status === "completed" ? new Date().toTimeString().slice(0, 5) : ""
    });
    if (!storage.write(KEYS.tasks, rows)) throw new Error("任务状态保存失败");
    return delay(rows[index], 150);
  },

  async getAttendance() {
    return delay(getPersisted(KEYS.attendance, mock.attendance));
  },

  async clock(action) {
    const attendance = getPersisted(KEYS.attendance, mock.attendance);
    if (action === "check_in" && attendance.status !== "not_checked_in") throw new Error("当前班次已签到");
    if (action === "check_out" && attendance.status !== "checked_in") throw new Error("请先完成签到");
    const time = new Date().toTimeString().slice(0, 5);
    const next = Object.assign({}, attendance, action === "check_in"
      ? { status: "checked_in", checkInTime: time }
      : { status: "checked_out", checkOutTime: time });
    if (!storage.write(KEYS.attendance, next)) throw new Error("考勤记录保存失败");
    return delay(next, 260);
  },

  async listAttendance() {
    const attendance = getPersisted(KEYS.attendance, mock.attendance);
    return delay(attendance.logs || []);
  },

  async listRecords(options) {
    const settings = options || {};
    const patientId = settings.patientId || "";
    const page = Math.max(1, Number(settings.page) || 1);
    const pageSize = Math.max(1, Math.min(20, Number(settings.pageSize) || 6));
    let rows = getPersisted(KEYS.records, mock.records);
    if (patientId) rows = rows.filter(item => item.patientId === patientId);
    rows = rows.slice().sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt));
    const start = (page - 1) * pageSize;
    return delay({
      rows: rows.slice(start, start + pageSize).map(item => Object.assign({}, item, { patient: patientById(item.patientId) })),
      total: rows.length,
      page,
      pageSize,
      hasMore: start + pageSize < rows.length
    });
  },

  async createRecord(record) {
    const content = String(record.content || "").trim();
    const result = String(record.result || "").trim();
    if (!record.patientId || !mock.patients.some(item => item.id === record.patientId)) throw new Error("请选择服务对象");
    if (!content) throw new Error("请填写照护事项");
    if (content.length > 300) throw new Error("照护事项不能超过300字");
    if (!result) throw new Error("请填写处理结果");
    if (result.length > 120) throw new Error("处理结果不能超过120字");
    const rows = getPersisted(KEYS.records, mock.records);
    const item = {
      id: `REC-${Date.now()}`,
      patientId: record.patientId,
      type: record.type || "日常照护",
      content,
      result,
      createdAt: new Date().toISOString(),
      author: mock.caregiver.name
    };
    rows.unshift(item);
    if (!storage.write(KEYS.records, rows.slice(0, 200))) throw new Error("照护记录保存失败");
    return delay(item, 180);
  },

  async listCertificates() {
    return delay(mock.certificates);
  },

  async listTraining() {
    return delay(mock.training);
  }
};

module.exports = repository;
