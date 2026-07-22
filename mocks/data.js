const now = Date.now();
const minutesAgo = minutes => new Date(now - minutes * 60000).toISOString();

const caregiver = {
  id: "CG-20250708",
  name: "周敏",
  role: "责任护工",
  organization: "康护中心二病区",
  employeeNo: "CG-0186",
  phoneMasked: "138****6028",
  avatarText: "周",
  shift: {
    id: "SHIFT-DAY-01",
    name: "白班",
    date: "2026-07-23",
    startTime: "08:00",
    endTime: "18:00",
    area: "二病区 A 组"
  }
};

const patients = [
  {
    id: "P-1008",
    deviceId: "device_1008",
    displayName: "陈女士",
    ageLabel: "68岁",
    bed: "A区 08床",
    room: "208室",
    careLevel: "重点照护",
    status: "danger",
    alertCount: 2,
    note: "输液进行中，关注血氧与余量",
    lastUpdate: minutesAgo(2),
    devices: [
      { id: "vital-1008", name: "生命体征监测仪", status: "online", updatedAt: minutesAgo(2) },
      { id: "infusion-1008", name: "输液监测器", status: "online", updatedAt: minutesAgo(1) }
    ],
    vitals: { heartRate: 108, breathing: 20, bloodOxygen: 89, bodyTemperature: 37.2, temperature: 24.6, humidity: 58, light: 420, pressure: 1012 },
    infusion: { initialWeight: 500, remainingWeight: 42, speed: 68, threshold: 50, updatedAt: minutesAgo(1) }
  },
  {
    id: "P-1012",
    deviceId: "device_1012",
    displayName: "王先生",
    ageLabel: "72岁",
    bed: "A区 12床",
    room: "210室",
    careLevel: "一级照护",
    status: "warning",
    alertCount: 1,
    note: "午后复测体温",
    lastUpdate: minutesAgo(5),
    devices: [
      { id: "vital-1012", name: "生命体征监测仪", status: "online", updatedAt: minutesAgo(5) },
      { id: "infusion-1012", name: "输液监测器", status: "standby", updatedAt: minutesAgo(30) }
    ],
    vitals: { heartRate: 86, breathing: 18, bloodOxygen: 96, bodyTemperature: 37.8, temperature: 25.1, humidity: 61, light: 360, pressure: 1010 },
    infusion: { initialWeight: 0, remainingWeight: 0, speed: 0, threshold: 0, updatedAt: minutesAgo(30) }
  },
  {
    id: "P-1015",
    deviceId: "device_1015",
    displayName: "刘女士",
    ageLabel: "64岁",
    bed: "B区 15床",
    room: "306室",
    careLevel: "二级照护",
    status: "normal",
    alertCount: 0,
    note: "按常规计划照护",
    lastUpdate: minutesAgo(3),
    devices: [
      { id: "vital-1015", name: "生命体征监测仪", status: "online", updatedAt: minutesAgo(3) },
      { id: "infusion-1015", name: "输液监测器", status: "standby", updatedAt: minutesAgo(22) }
    ],
    vitals: { heartRate: 78, breathing: 17, bloodOxygen: 97, bodyTemperature: 36.7, temperature: 24.2, humidity: 54, light: 390, pressure: 1013 },
    infusion: { initialWeight: 0, remainingWeight: 0, speed: 0, threshold: 0, updatedAt: minutesAgo(22) }
  },
  {
    id: "P-1021",
    deviceId: "device_1021",
    displayName: "赵先生",
    ageLabel: "75岁",
    bed: "B区 21床",
    room: "309室",
    careLevel: "一级照护",
    status: "normal",
    alertCount: 0,
    note: "今日安排翻身与饮水记录",
    lastUpdate: minutesAgo(7),
    devices: [
      { id: "vital-1021", name: "生命体征监测仪", status: "online", updatedAt: minutesAgo(7) },
      { id: "infusion-1021", name: "输液监测器", status: "offline", updatedAt: minutesAgo(95) }
    ],
    vitals: { heartRate: 82, breathing: 16, bloodOxygen: 96, bodyTemperature: 36.5, temperature: 24.9, humidity: 56, light: 405, pressure: 1011 },
    infusion: { initialWeight: 0, remainingWeight: 0, speed: 0, threshold: 0, updatedAt: minutesAgo(95) }
  },
  {
    id: "P-1026",
    deviceId: "device_1026",
    displayName: "孙女士",
    ageLabel: "70岁",
    bed: "B区 26床",
    room: "312室",
    careLevel: "二级照护",
    status: "normal",
    alertCount: 0,
    note: "晚班交接前确认用餐情况",
    lastUpdate: minutesAgo(8),
    devices: [
      { id: "vital-1026", name: "生命体征监测仪", status: "online", updatedAt: minutesAgo(8) }
    ],
    vitals: { heartRate: 80, breathing: 17, bloodOxygen: 98, bodyTemperature: 36.6, temperature: 24.4, humidity: 57, light: 375, pressure: 1014 },
    infusion: { initialWeight: 0, remainingWeight: 0, speed: 0, threshold: 0, updatedAt: minutesAgo(80) }
  }
];

const alerts = [
  {
    id: "ALT-001",
    patientId: "P-1008",
    level: "danger",
    title: "血氧低于关注范围",
    description: "最近一次血氧为 89%，请先核对设备佩戴并复测。",
    metric: "bloodOxygen",
    value: 89,
    unit: "%",
    occurredAt: minutesAgo(2),
    status: "pending"
  },
  {
    id: "ALT-002",
    patientId: "P-1008",
    level: "warning",
    title: "输液余量接近阈值",
    description: "当前余量 42g，设置阈值 50g，请及时查看。",
    metric: "infusionWeight",
    value: 42,
    unit: "g",
    occurredAt: minutesAgo(1),
    status: "pending"
  },
  {
    id: "ALT-003",
    patientId: "P-1012",
    level: "warning",
    title: "体温需要复测",
    description: "最近一次体温为 37.8℃，建议按照护计划复测并记录。",
    metric: "bodyTemperature",
    value: 37.8,
    unit: "℃",
    occurredAt: minutesAgo(5),
    status: "pending"
  }
];

const tasks = [
  { id: "TSK-001", patientId: "P-1008", title: "核对输液余量", category: "监测", priority: "urgent", status: "pending", scheduledTime: "09:20", location: "208室 08床", note: "核对瓶签、滴速和管路状态，完成后记录。" },
  { id: "TSK-002", patientId: "P-1012", title: "复测体温", category: "生命体征", priority: "high", status: "processing", scheduledTime: "10:00", location: "210室 12床", note: "使用病区设备复测并填写结果。" },
  { id: "TSK-003", patientId: "P-1021", title: "协助翻身", category: "基础照护", priority: "normal", status: "pending", scheduledTime: "10:30", location: "309室 21床", note: "按交接要求协助翻身，观察受压部位。" },
  { id: "TSK-004", patientId: "P-1015", title: "饮水情况记录", category: "照护记录", priority: "normal", status: "pending", scheduledTime: "11:00", location: "306室 15床", note: "记录本时段饮水量和配合情况。" },
  { id: "TSK-005", patientId: "P-1026", title: "午餐协助", category: "生活照护", priority: "normal", status: "pending", scheduledTime: "11:30", location: "312室 26床", note: "按膳食单协助用餐，异常情况及时反馈。" },
  { id: "TSK-006", patientId: "P-1008", title: "晨间生命体征记录", category: "生命体征", priority: "normal", status: "completed", scheduledTime: "08:30", completedTime: "08:38", location: "208室 08床", note: "已完成设备数据核对。" },
  { id: "TSK-007", patientId: "P-1015", title: "床旁环境检查", category: "安全巡查", priority: "normal", status: "completed", scheduledTime: "08:45", completedTime: "08:51", location: "306室 15床", note: "通道和呼叫设备状态正常。" },
  { id: "TSK-008", patientId: "P-1021", title: "饮水提醒", category: "基础照护", priority: "normal", status: "pending", scheduledTime: "13:30", location: "309室 21床", note: "根据当日照护计划执行。" },
  { id: "TSK-009", patientId: "P-1012", title: "床旁安全巡查", category: "安全巡查", priority: "normal", status: "pending", scheduledTime: "14:00", location: "210室 12床", note: "检查床栏、呼叫器与地面情况。" },
  { id: "TSK-010", patientId: "P-1026", title: "协助活动", category: "基础照护", priority: "normal", status: "pending", scheduledTime: "15:00", location: "312室 26床", note: "按计划在照护区域内活动。" }
];

const attendance = {
  status: "not_checked_in",
  checkInTime: "",
  checkOutTime: "",
  locationStatus: "not_requested",
  logs: [
    { id: "ATT-0722", date: "2026-07-22", shift: "白班 08:00-18:00", checkInTime: "07:53", checkOutTime: "18:06", result: "normal" },
    { id: "ATT-0721", date: "2026-07-21", shift: "白班 08:00-18:00", checkInTime: "07:55", checkOutTime: "18:02", result: "normal" },
    { id: "ATT-0720", date: "2026-07-20", shift: "白班 08:00-18:00", checkInTime: "08:04", checkOutTime: "18:03", result: "late" }
  ]
};

const certificates = [
  { id: "CERT-001", name: "养老护理员职业技能等级证书", number: "YLHL-2024-01862", validFrom: "2024-03-01", validTo: "2027-02-28", status: "valid" },
  { id: "CERT-002", name: "基础急救培训合格证", number: "FA-2025-00618", validFrom: "2025-09-10", validTo: "2026-09-09", status: "expiring" },
  { id: "CERT-003", name: "岗前健康检查证明", number: "HC-2026-0312", validFrom: "2026-03-12", validTo: "2027-03-11", status: "valid" }
];

const training = [
  { id: "TR-001", title: "老年人跌倒风险识别", type: "培训", deadline: "2026-07-28", duration: "25分钟", status: "pending" },
  { id: "TR-002", title: "输液巡视与异常上报规范", type: "考核", deadline: "2026-07-31", duration: "20分钟", status: "pending" },
  { id: "TR-003", title: "院感基础规范复训", type: "培训", completedAt: "2026-07-15", score: "合格", status: "completed" }
];

const records = [
  { id: "REC-001", patientId: "P-1008", type: "生命体征", content: "晨间监测数据已核对，设备佩戴状态正常。", result: "继续观察", createdAt: minutesAgo(82), author: "周敏" },
  { id: "REC-002", patientId: "P-1015", type: "生活照护", content: "已协助完成早餐，用餐过程平稳。", result: "已完成", createdAt: minutesAgo(70), author: "周敏" },
  { id: "REC-003", patientId: "P-1021", type: "交接记录", content: "接班时已核对床旁呼叫器与床栏状态。", result: "设备正常", createdAt: minutesAgo(55), author: "周敏" },
  { id: "REC-004", patientId: "P-1012", type: "异常观察", content: "体温略高，已安排 10:00 复测。", result: "待复测", createdAt: minutesAgo(36), author: "周敏" }
];

const buildHistory = (patientId, metric, points) => {
  const patientIndex = Math.max(0, patients.findIndex(item => item.id === patientId));
  const baselines = { heartRate: 78, breathing: 17, bloodOxygen: 97, bodyTemperature: 36.7, temperature: 24.5, humidity: 57, light: 400, pressure: 1012, infusionSpeed: 55 };
  const amplitudes = { heartRate: 8, breathing: 2, bloodOxygen: 1.5, bodyTemperature: 0.35, temperature: 1.2, humidity: 4, light: 55, pressure: 4, infusionSpeed: 10 };
  const list = [];
  const count = points || 12;
  for (let index = count - 1; index >= 0; index -= 1) {
    const time = new Date(now - index * 10 * 60000);
    const baseline = baselines[metric] || 0;
    const amplitude = amplitudes[metric] || 1;
    const variation = Math.sin((count - index + patientIndex) * 0.7) * amplitude + Math.cos(index * 0.35) * amplitude * 0.25;
    let value = baseline + variation;
    if (patientId === "P-1008" && metric === "bloodOxygen" && index < 3) value -= 5;
    if (patientId === "P-1012" && metric === "bodyTemperature" && index < 4) value += 0.9;
    list.push({ time: time.toISOString(), value: Number(value.toFixed(metric === "bodyTemperature" || metric === "temperature" ? 1 : 0)) });
  }
  return list;
};

module.exports = { caregiver, patients, alerts, tasks, attendance, certificates, training, records, buildHistory };
