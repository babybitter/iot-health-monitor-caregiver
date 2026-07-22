const assert = require("assert");

const memory = new Map();
global.wx = {
  getStorageSync(key) { return memory.has(key) ? memory.get(key) : ""; },
  setStorageSync(key, value) { memory.set(key, value); },
  removeStorageSync(key) { memory.delete(key); }
};

const config = require("../config/index.js");
const demoBusiness = require("../mocks/demo-business-data.js");
const { evaluateMetric, formatMetric } = require("../utils/health");
const workStore = require("../store/work-store");
const repository = require("../services/repository");

const testNavigation = () => {
  let componentDefinition;
  let navigateBackCalls = 0;
  let switchedUrl = "";
  global.Component = definition => { componentDefinition = definition; };
  global.getCurrentPages = () => [{ route: "pages/tasks/tasks" }, { route: "pages/task-detail/task-detail" }];
  wx.navigateBack = options => {
    navigateBackCalls += 1;
    options.complete();
  };
  wx.switchTab = options => {
    switchedUrl = options.url;
    options.complete();
  };
  require("../components/app-nav/app-nav.js");

  const component = {};
  componentDefinition.methods.goBack.call(component);
  assert.strictEqual(navigateBackCalls, 1);
  assert.strictEqual(component._isNavigatingBack, false);

  global.getCurrentPages = () => [{ route: "pages/task-detail/task-detail" }];
  componentDefinition.methods.goBack.call(component);
  assert.strictEqual(switchedUrl, "/pages/workbench/workbench");
};

const message = (topic, payload, offset) => workStore.handleRealtimeEvent({
  type: "message",
  topic,
  payload,
  receivedAt: new Date(Date.now() + (offset || 0)).toISOString()
});

const run = async () => {
  testNavigation();
  assert.strictEqual(evaluateMetric("heartRate", 80), "normal");
  assert.strictEqual(evaluateMetric("heartRate", 110), "warning");
  assert.strictEqual(evaluateMetric("bloodOxygen", 89), "danger");
  assert.strictEqual(formatMetric("bodyTemperature", 36.78).value, "36.8");

  const expectedTopics = {
    light: "patient/monitor/light",
    pressure: "patient/monitor/pressure",
    temperature: "patient/monitor/temperature",
    humidity: "patient/monitor/humidity",
    breathing: "patient/monitor/breathing",
    heartRate: "patient/monitor/heart_rate",
    bloodOxygen: "patient/monitor/blood_oxygen",
    bodyTemperature: "patient/upload/data/temperature",
    weight: "patient/monitor/weight",
    weightBegin: "patient/monitor/weight-begin",
    infusionSpeed: "patient/monitor/infusion-speed",
    deviceStatus: "patient/status/device",
    dataUpload: "patient/upload/data",
    deviceAdvice: "patient/advice/device",
    vitalTemperature: "patient/upload/data/temperature",
    hardwareDevices: "home/devices/onoff/#"
  };
  assert.deepStrictEqual(config.mqtt.topics, expectedTopics);
  assert.strictEqual(config.mqtt.publishTopic, "patient/control/device");

  workStore.handleRealtimeEvent({ type: "connection", connected: true });
  message(config.mqtt.topics.heartRate, { value: 110 });
  message(config.mqtt.topics.bodyTemperature, "36.8", 1);
  message(config.mqtt.topics.dataUpload, { humidity: 56, pressure: 1012, blood_oxygen: 97 }, 2);
  message(config.mqtt.topics.weightBegin, { value: 500 }, 3);
  message(config.mqtt.topics.weight, 80, 4);
  message(config.mqtt.topics.infusionSpeed, { value: 45 }, 5);
  message(config.mqtt.topics.deviceStatus, { device: "light", status: true, online: true }, 6);

  const monitor = workStore.getState().monitor;
  assert.strictEqual(monitor.metrics.heartRate.value, 110);
  assert.strictEqual(monitor.metrics.bodyTemperature.value, 36.8);
  assert.strictEqual(monitor.metrics.humidity.value, 56);
  assert.strictEqual(monitor.metrics.pressure.value, 1012);
  assert.strictEqual(monitor.metrics.bloodOxygen.value, 97);
  assert.strictEqual(monitor.infusion.initialWeight, 500);
  assert.strictEqual(monitor.infusion.remainingWeight, 80);
  assert.strictEqual(monitor.infusion.speed, 45);
  assert.strictEqual(monitor.device.controls.light, true);
  assert.ok(monitor.alerts.some(item => item.id === "metric-heartRate"));
  assert.strictEqual(workStore.getLiveHistory("heartRate", "2h").length, 1);

  assert.strictEqual(workStore.acknowledgeAlert("metric-heartRate"), true);
  assert.ok(!workStore.getState().monitor.alerts.some(item => item.id === "metric-heartRate"));

  const subjectPage = await repository.listPatients({ page: 1, pageSize: 5 });
  assert.strictEqual(subjectPage.rows.length, 1);
  assert.strictEqual(subjectPage.rows[0].id, config.careSubject.id);
  const tasks = await repository.listTasks({ status: "all", page: 1, pageSize: 6 });
  assert.strictEqual(tasks.total, 8);
  assert.strictEqual(tasks.rows.length, 6);
  const updatedTask = await repository.updateTask("DEMO-TASK-003", "processing");
  assert.strictEqual(updatedTask.status, "processing");
  const taskDetail = await repository.getTask("DEMO-TASK-003");
  assert.strictEqual(taskDetail.patient.id, config.careSubject.id);
  assert.strictEqual((await repository.listCertificates()).length, 3);
  assert.strictEqual((await repository.listTraining()).length, 5);
  assert.deepStrictEqual(Object.keys(demoBusiness).sort(), ["certificates", "createTasks", "training"]);
  assert.ok(!/(heartRate|bloodOxygen|infusionSpeed|deviceStatus)/.test(JSON.stringify(demoBusiness)));

  const checkedIn = await repository.clock("check_in");
  assert.strictEqual(checkedIn.status, "checked_in");
  const checkedOut = await repository.clock("check_out");
  assert.strictEqual(checkedOut.status, "checked_out");
  assert.strictEqual(checkedOut.logs.length, 2);

  await assert.rejects(
    repository.createRecord({ patientId: config.careSubject.id, content: "", result: "已处理" }),
    /照护事项/
  );
  const record = await repository.createRecord({
    patientId: config.careSubject.id,
    type: "异常观察",
    content: "已完成现场核对",
    result: "继续观察"
  });
  assert.strictEqual(record.patientId, config.careSubject.id);

  console.log("Core logic tests passed: MQTT live data, isolated business demos, tasks, attendance and records.");
};

run().catch(error => {
  console.error(error);
  process.exit(1);
});
