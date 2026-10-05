const test = require('node:test');
const assert = require('node:assert/strict');

const { thresholdPlan } = require('../src/lib/stopAlerts');

test('a 12-to-4 minute jump sends 5 and records 10 as skipped', () => {
  assert.deepEqual(thresholdPlan(4, [10, 5, 1]), { send: 5, skip: [10] });
});

test('delivered thresholds are restart-safe and ETA oscillation does not duplicate them', () => {
  assert.deepEqual(thresholdPlan(4, [10, 5, 1], [10, 5]), { send: null, skip: [] });
  assert.deepEqual(thresholdPlan(0, [10, 5, 1], [10, 5]), { send: 1, skip: [] });
});
