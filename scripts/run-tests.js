const assert = require("assert");

const memory = new Map();
global.wx = {
  getStorageSync(key) { return memory.has(key) ? memory.get(key) : ""; },
  setStorageSync(key, value) { memory.set(key, value); },
  removeStorageSync(key) { memory.delete(key); }
};

const { evaluateMetric, formatMetric } = require("../utils/health");
const repository = require("../services/repository");

const run = async () => {
  assert.strictEqual(evaluateMetric("heartRate", 80), "normal");
  assert.strictEqual(evaluateMetric("heartRate", 110), "warning");
  assert.strictEqual(evaluateMetric("bloodOxygen", 89), "danger");
  assert.strictEqual(formatMetric("bodyTemperature", 36.78).value, "36.8");

  const firstPage = await repository.listPatients({ page: 1, pageSize: 2 });
  assert.strictEqual(firstPage.rows.length, 2);
  assert.strictEqual(firstPage.hasMore, true);

  const history = await repository.getHistory("P-1008", "bloodOxygen", "2h");
  assert.strictEqual(history.length, 12);
  assert.ok(history.every(item => Number.isFinite(item.value)));

  const deviceControl = await repository.updateDeviceControl("P-1008", "light", true);
  assert.strictEqual(deviceControl.enabled, true);

  await repository.updateTask("TSK-003", "processing");
  const processingTask = await repository.getTask("TSK-003");
  assert.strictEqual(processingTask.status, "processing");
  await repository.updateTask("TSK-003", "completed");
  const completedTask = await repository.getTask("TSK-003");
  assert.strictEqual(completedTask.status, "completed");

  const checkedIn = await repository.clock("check_in");
  assert.strictEqual(checkedIn.status, "checked_in");
  const checkedOut = await repository.clock("check_out");
  assert.strictEqual(checkedOut.status, "checked_out");

  await assert.rejects(
    repository.createRecord({ patientId: "P-1008", content: "", result: "已处理" }),
    /照护事项/
  );
  const record = await repository.createRecord({ patientId: "P-1008", type: "异常观察", content: "已完成现场核对", result: "继续观察" });
  assert.strictEqual(record.patientId, "P-1008");

  console.log("Core logic tests passed: thresholds, paging, trends, device controls, tasks, attendance and records.");
};

run().catch(error => {
  console.error(error);
  process.exit(1);
});
