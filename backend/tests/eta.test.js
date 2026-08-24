const test = require('node:test');
const assert = require('node:assert/strict');
const { etaRange } = require('../src/lib/eta');

test('ETA ranges widen as confidence decreases and never become negative', () => {
  const high = etaRange(20, 'HIGH');
  const low = etaRange(20, 'LOW');
  assert.ok(low.min <= high.min);
  assert.ok(low.max >= high.max);
  assert.deepEqual(etaRange(1, 'LOW'), { min: 0, max: 3 });
});
