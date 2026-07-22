// 仅用于尚未接入业务接口的任务、证书和培训演示。
// 禁止在此文件中添加生命体征、设备状态、异常或趋势数据。
const createTasks = patientId => [
  {
    id: "DEMO-TASK-001",
    patientId,
    title: "输液装置现场巡查",
    category: "输液巡视",
    priority: "urgent",
    status: "pending",
    scheduledTime: "09:20",
    location: "当前监护设备",
    note: "核对瓶签、管路和滴速，确认现场情况后填写巡视记录。"
  },
  {
    id: "DEMO-TASK-002",
    patientId,
    title: "协助体位调整",
    category: "基础照护",
    priority: "high",
    status: "processing",
    scheduledTime: "10:00",
    location: "当前照护区域",
    note: "按交接要求协助调整体位，并观察受压部位情况。"
  },
  {
    id: "DEMO-TASK-003",
    patientId,
    title: "床旁安全检查",
    category: "安全巡查",
    priority: "normal",
    status: "pending",
    scheduledTime: "10:30",
    location: "当前照护区域",
    note: "检查床栏、呼叫器、通道和地面情况。"
  },
  {
    id: "DEMO-TASK-004",
    patientId,
    title: "饮水情况记录",
    category: "生活照护",
    priority: "normal",
    status: "pending",
    scheduledTime: "11:00",
    location: "当前照护区域",
    note: "记录本时段饮水情况，发现明显异常时按流程反馈。"
  },
  {
    id: "DEMO-TASK-005",
    patientId,
    title: "晨间照护交接",
    category: "交接记录",
    priority: "normal",
    status: "completed",
    scheduledTime: "08:20",
    completedTime: "08:28",
    location: "值守区域",
    note: "核对本班次重点事项和设备监护要求。"
  },
  {
    id: "DEMO-TASK-006",
    patientId,
    title: "环境安全巡查",
    category: "安全巡查",
    priority: "normal",
    status: "completed",
    scheduledTime: "08:45",
    completedTime: "08:52",
    location: "当前照护区域",
    note: "检查照护区域照明、通风和通行情况。"
  },
  {
    id: "DEMO-TASK-007",
    patientId,
    title: "午后活动协助",
    category: "生活照护",
    priority: "normal",
    status: "pending",
    scheduledTime: "13:30",
    location: "当前照护区域",
    note: "按照护安排协助进行适量活动，记录完成情况。"
  },
  {
    id: "DEMO-TASK-008",
    patientId,
    title: "监测设备佩戴检查",
    category: "设备巡查",
    priority: "high",
    status: "pending",
    scheduledTime: "15:00",
    location: "当前监护设备",
    note: "检查传感器佩戴和连接状态，不对监测结果作诊断性判断。"
  }
];

const certificates = [
  {
    id: "DEMO-CERT-001",
    name: "养老护理员职业技能等级证书",
    number: "YLHL-DEMO-01862",
    validFrom: "2024-03-01",
    validTo: "2027-02-28",
    status: "valid"
  },
  {
    id: "DEMO-CERT-002",
    name: "基础急救培训合格证",
    number: "FA-DEMO-00618",
    validFrom: "2025-09-10",
    validTo: "2026-09-09",
    status: "expiring"
  },
  {
    id: "DEMO-CERT-003",
    name: "岗前健康检查证明",
    number: "HC-DEMO-0312",
    validFrom: "2026-03-12",
    validTo: "2027-03-11",
    status: "valid"
  }
];

const training = [
  {
    id: "DEMO-TRAIN-001",
    title: "跌倒风险识别与现场处置",
    type: "培训",
    deadline: "2026-07-28",
    duration: "25分钟",
    status: "pending"
  },
  {
    id: "DEMO-TRAIN-002",
    title: "输液巡视与异常上报规范",
    type: "考核",
    deadline: "2026-07-31",
    duration: "20分钟",
    status: "pending"
  },
  {
    id: "DEMO-TRAIN-003",
    title: "监测设备日常检查要点",
    type: "培训",
    deadline: "2026-08-05",
    duration: "30分钟",
    status: "pending"
  },
  {
    id: "DEMO-TRAIN-004",
    title: "院感基础规范复训",
    type: "培训",
    completedAt: "2026-07-15",
    score: "合格",
    status: "completed"
  },
  {
    id: "DEMO-TRAIN-005",
    title: "照护记录书写规范",
    type: "考核",
    completedAt: "2026-06-26",
    score: "92分",
    status: "completed"
  }
];

module.exports = { createTasks, certificates, training };
