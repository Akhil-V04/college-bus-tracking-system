const test = require('node:test');
const assert = require('node:assert/strict');

const {
  assessLocationSample,
  classifyRouteProgress,
  distanceToRouteMeters,
  locationFreshness,
} = require('../src/lib/liveTracking');

const now = new Date('2026-08-25T04:30:00.000Z');

test('GPS assessment rejects stale, future, duplicate, out-of-order, inaccurate, and impossible samples', () => {
  const base = { latitude: 17.4, longitude: 78.5, deviceTimestamp: now };
  assert.equal(assessLocationSample({ sample: { ...base, accuracyMeters: 500 }, now }).reason, 'POOR_ACCURACY');
  assert.equal(assessLocationSample({ sample: { ...base, deviceTimestamp: new Date(now - 6 * 60_000) }, now }).reason, 'DEVICE_TIMESTAMP_TOO_OLD');
  assert.equal(assessLocationSample({ sample: { ...base, deviceTimestamp: new Date(now.getTime() + 3 * 60_000) }, now }).reason, 'DEVICE_TIMESTAMP_IN_FUTURE');
  assert.equal(assessLocationSample({ sample: base, latestDeviceTimestamp: now, now }).reason, 'DUPLICATE_SAMPLE');
  assert.equal(assessLocationSample({ sample: { ...base, deviceTimestamp: new Date(now - 1_000) }, latestDeviceTimestamp: now, now }).reason, 'OUT_OF_ORDER_SAMPLE');
  assert.equal(
    assessLocationSample({
      sample: base,
      latestAccepted: { latitude: 18.4, longitude: 78.5, deviceTimestamp: new Date(now - 1_000), receivedAt: new Date(now - 1_000) },
      now,
    }).reason,
    'IMPOSSIBLE_SPEED'
  );
});

test('route progress reaches the next stop and marks bypassed stops as possibly skipped', () => {
  const stops = [
    { id: 1, stop: { latitude: 17.4, longitude: 78.5 } },
    { id: 2, stop: { latitude: 17.41, longitude: 78.51 } },
    { id: 3, stop: { latitude: 17.42, longitude: 78.52 } },
  ];
  const reached = classifyRouteProgress({ latitude: 17.4, longitude: 78.5, stops, currentStopIndex: 0 });
  assert.equal(reached.nextStopIndex, 1);
  assert.deepEqual(reached.events, [{ index: 0, status: 'REACHED' }]);

  const jumped = classifyRouteProgress({ latitude: 17.42, longitude: 78.52, stops, currentStopIndex: 0 });
  assert.equal(jumped.nextStopIndex, 3);
  assert.deepEqual(jumped.events, [
    { index: 0, status: 'POSSIBLY_SKIPPED' },
    { index: 1, status: 'POSSIBLY_SKIPPED' },
    { index: 2, status: 'REACHED' },
  ]);
});

test('off-route samples do not advance progress', () => {
  const stops = [
    { stop: { latitude: 17.4, longitude: 78.5 } },
    { stop: { latitude: 17.41, longitude: 78.51 } },
  ];
  const result = classifyRouteProgress({ latitude: 18.4, longitude: 79.5, stops, currentStopIndex: 0 });
  assert.equal(result.state, 'OFF_ROUTE');
  assert.equal(result.nextStopIndex, 0);
  assert.deepEqual(result.events, []);
  assert.ok(distanceToRouteMeters(18.4, 79.5, stops) > 2000);
});

test('location freshness distinguishes missing, stale, and live GPS', () => {
  assert.equal(locationFreshness(null, now), 'NO_LIVE_DATA');
  assert.equal(locationFreshness(new Date(now - 3 * 60_000), now), 'STALE_LOCATION');
  assert.equal(locationFreshness(new Date(now - 30_000), now), 'LIVE');
});
