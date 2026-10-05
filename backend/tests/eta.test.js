const test = require('node:test');
const assert = require('node:assert/strict');
const { etaRange, passedStopResult, segmentTravelSeconds } = require('../src/lib/eta');

test('ETA ranges widen as confidence decreases and never become negative', () => {
  const high = etaRange(20, 'HIGH');
  const low = etaRange(20, 'LOW');
  assert.ok(low.min <= high.min);
  assert.ok(low.max >= high.max);
  assert.deepEqual(etaRange(1, 'LOW'), { min: 0, max: 3 });
});

test('passed stop results never return a negative ETA and distinguish possible skips', () => {
  const latest = { receivedAt: new Date('2026-08-25T04:30:00.000Z') };
  const passed = passedStopResult(9, 4, { status: 'REACHED', detectedAt: latest.receivedAt }, latest);
  const skipped = passedStopResult(9, 4, { status: 'POSSIBLY_SKIPPED', detectedAt: latest.receivedAt }, latest);
  assert.equal(passed.status, 'PASSED');
  assert.equal(skipped.status, 'POSSIBLY_SKIPPED');
  assert.equal(passed.etaMinutes, null);
  assert.equal(skipped.etaRangeMinutes, null);
});

test('live slow movement outweighs optimistic history and stationary evidence pauses ETA', () => {
  assert.equal(segmentTravelSeconds(1000, 10, true, 120), 360);
  assert.equal(segmentTravelSeconds(1000, 60, true, 120), 120);
  assert.equal(segmentTravelSeconds(1000, 25, null, 180), 180);
  assert.equal(segmentTravelSeconds(1000, 25, false, 180), null);
});
