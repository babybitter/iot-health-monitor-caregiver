const config = require("../config/index.js");
const demoBusiness = require("../mocks/demo-business-data.js");
const workStore = require("../store/work-store");
const storage = require("../utils/storage");

const KEYS = {
  caregiver: "caregiver_profile",
  attendance: "caregiver_attendance",
  tasks: "caregiver_tasks",
  taskDemoVersion: "caregiver_task_demo_version",
  records: "caregiver_records"
};

const clone = value => JSON.parse(JSON.stringify(value));
const resolved = value => Promise.resolve(clone(value));
const today = () => new Date().toISOString().slice(0, 10);
const currentTime = () => new Date().toTimeString().slice(0, 5);
const TASK_DEMO_VERSION = "2026-07-single-device-v1";
const getTaskState = () => {
  const defaults = clone(demoBusiness.createTasks(config.careSubject.id));
  if (storage.read(KEYS.taskDemoVersion, "") !== TASK_DEMO_VERSION) {
    storage.write(KEYS.tasks, defaults);
    storage.write(KEYS.taskDemoVersion, TASK_DEMO_VERSION);
    return defaults;
  }
  return storage.read(KEYS.tasks, defaults);
};

const defaultCaregiver = {
  name: "护工用户",
  role: "照护人员",
  employeeNo: "未绑定",
  organization: "机构信息待配置",
  avatar: "/images/default-avatar.png",
  shift: { name: "当前班次", startTime: "--:--", endTime: "--:--", area: "值守区域待配置" }
};

const defaultAttendance = () => ({
  date: today(),
  status: "not_checked_in",
  checkInTime: "",
  checkOutTime: "",
  logs: []
});

const getAttendanceState = () => {
  const saved = storage.read(KEYS.attendance, null);
  if (!saved || saved.date !== today()) return defaultAttendance();
  return saved;
};

const currentSubject = () => {
  const monitor = workStore.getState().monitor;
  const statuses = Object.keys(monitor.metrics).map(type => monitor.metrics[type].status);
  const status = statuses.includes("danger") ? "danger" : statuses.includes("warning") ? "warning" : monitor.lastUpdate ? "normal" : "offline";
  return {
    id: config.careSubject.id,
    displayName: config.careSubject.displayName,
    room: "",
    bed: config.careSubject.location,
    careLevel: config.careSubject.careLevel,
    status,
    alertCount: monitor.alerts.length,
    note: "单套实体设备实时监护",
    lastUpdate: monitor.lastUpdate,
    vitals: Object.keys(monitor.metrics).reduce((result, type) => {
      result[type] = monitor.metrics[type].value;
      return result;
    }, {}),
    infusion: clone(monitor.infusion),
    devices: [{
      id: "current-monitor-device",
      name: config.careSubject.location,
      status: monitor.device.status,
      updatedAt: monitor.device.updatedAt
    }]
  };
};

const paginate = (rows, options) => {
  const settings = options || {};
  const page = Math.max(1, Number(settings.page) || 1);
  const pageSize = Math.max(1, Math.min(20, Number(settings.pageSize) || 6));
  const start = (page - 1) * pageSize;
  return { rows: rows.slice(start, start + pageSize), total: rows.length, page, pageSize, hasMore: start + pageSize < rows.length };
};

const repository = {
  getCaregiverProfile() {
    return Object.assign({}, defaultCaregiver, storage.read(KEYS.caregiver, {}));
  },

  saveCaregiverProfile(patch) {
    const profile = Object.assign({}, this.getCaregiverProfile(), patch || {});
    if (!storage.write(KEYS.caregiver, profile)) throw new Error("个人信息保存失败");
    return clone(profile);
  },

  getSelectedPatientId() {
    return config.careSubject.id;
  },

  selectPatient() {
    return clone(currentSubject());
  },

  async getDashboard() {
    const caregiver = this.getCaregiverProfile();
    const attendance = getAttendanceState();
    const taskList = getTaskState();
    const subject = currentSubject();
    const alerts = workStore.getState().monitor.alerts.map(item => Object.assign({}, item, { patientId: subject.id }));
    return {
      caregiver,
      shift: caregiver.shift,
      attendance,
      patients: [subject],
      alerts: alerts.slice(0, 3),
      tasks: taskList.filter(item => item.status !== "completed").slice(0, 4),
      counts: {
        patients: 1,
        alerts: alerts.length,
        pendingTasks: taskList.filter(item => item.status !== "completed").length,
        completedTasks: taskList.filter(item => item.status === "completed").length
      }
    };
  },

  async listPatients(options) {
    const settings = options || {};
    const subject = currentSubject();
    const query = String(settings.query || "").trim().toLowerCase();
    const matchesQuery = !query || [subject.displayName, subject.bed, subject.id].some(value => String(value).toLowerCase().includes(query));
    const matchesStatus = !settings.status || settings.status === "all" || settings.status === subject.status;
    return paginate(matchesQuery && matchesStatus ? [subject] : [], settings);
  },

  async getPatient() {
    return clone(currentSubject());
  },

  async getMonitorSnapshot() {
    return clone(currentSubject());
  },

  async getHistory(patientId, metric, range) {
    return clone(workStore.getLiveHistory(metric, range));
  },

  async listAlerts() {
    return clone(workStore.getState().monitor.alerts.map(item => Object.assign({}, item, { patientId: config.careSubject.id, status: "pending" })));
  },

  async acknowledgeAlert(alertId) {
    if (!workStore.acknowledgeAlert(alertId)) throw new Error("告警已更新或不存在");
    return { id: alertId, status: "acknowledged", handledAt: new Date().toISOString() };
  },

  async updateDeviceControl() {
    throw new Error("请通过 MQTT 实时通道控制设备");
  },

  async listTasks(options) {
    const settings = options || {};
    let rows = getTaskState().slice();
    if (settings.status && settings.status !== "all") rows = rows.filter(item => item.status === settings.status);
    rows.sort((left, right) => String(left.scheduledTime || "").localeCompare(String(right.scheduledTime || "")));
    return resolved(paginate(rows, settings));
  },

  async getTask(taskId) {
    const task = getTaskState().find(item => item.id === taskId);
    if (!task) throw new Error("任务不存在或尚未从业务系统同步");
    return clone(Object.assign({}, task, { patient: currentSubject() }));
  },

  async updateTask(taskId, status) {
    if (!["pending", "processing", "completed"].includes(status)) throw new Error("任务状态无效");
    const rows = getTaskState();
    const index = rows.findIndex(item => item.id === taskId);
    if (index < 0) throw new Error("任务不存在或尚未从业务系统同步");
    rows[index] = Object.assign({}, rows[index], {
      status,
      updatedAt: new Date().toISOString(),
      completedTime: status === "completed" ? currentTime() : ""
    });
    if (!storage.write(KEYS.tasks, rows)) throw new Error("任务状态保存失败");
    return clone(rows[index]);
  },

  async getAttendance() {
    return clone(getAttendanceState());
  },

  async clock(action) {
    const attendance = getAttendanceState();
    if (action === "check_in" && attendance.status !== "not_checked_in") throw new Error("当前班次已签到");
    if (action === "check_out" && attendance.status !== "checked_in") throw new Error("请先完成签到");
    const time = currentTime();
    const log = { id: `ATT-${Date.now()}`, date: attendance.date, action, time, location: "未校验定位" };
    const next = Object.assign({}, attendance, action === "check_in"
      ? { status: "checked_in", checkInTime: time }
      : { status: "checked_out", checkOutTime: time }, { logs: (attendance.logs || []).concat([log]) });
    if (!storage.write(KEYS.attendance, next)) throw new Error("考勤记录保存失败");
    return clone(next);
  },

  async listAttendance() {
    return clone(getAttendanceState().logs || []);
  },

  async listRecords(options) {
    const settings = options || {};
    let rows = storage.read(KEYS.records, []).slice();
    if (settings.patientId) rows = rows.filter(item => item.patientId === settings.patientId);
    rows.sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt));
    const result = paginate(rows, settings);
    result.rows = result.rows.map(item => Object.assign({}, item, { patient: currentSubject() }));
    return clone(result);
  },

  async createRecord(record) {
    const content = String(record.content || "").trim();
    const result = String(record.result || "").trim();
    if (record.patientId !== config.careSubject.id) throw new Error("当前照护对象无效");
    if (!content) throw new Error("请填写照护事项");
    if (content.length > 300) throw new Error("照护事项不能超过300字");
    if (!result) throw new Error("请填写处理结果");
    if (result.length > 120) throw new Error("处理结果不能超过120字");
    const rows = storage.read(KEYS.records, []);
    const item = {
      id: `REC-${Date.now()}`,
      patientId: config.careSubject.id,
      type: record.type || "日常照护",
      content,
      result,
      createdAt: new Date().toISOString(),
      author: this.getCaregiverProfile().name
    };
    rows.unshift(item);
    if (!storage.write(KEYS.records, rows.slice(0, 200))) throw new Error("照护记录保存失败");
    return clone(item);
  },

  async listCertificates() {
    return clone(demoBusiness.certificates);
  },

  async listTraining() {
    return clone(demoBusiness.training);
  }
};

module.exports = repository;
