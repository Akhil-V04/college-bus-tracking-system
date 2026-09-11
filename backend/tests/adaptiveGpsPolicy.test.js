const test = require('node:test');
const assert = require('node:assert/strict');
const { adaptiveGpsPolicy, shouldTransmit } = require('../src/lib/adaptiveGpsPolicy');

test('adaptive GPS keeps collection separate from bounded send modes', () => {
  assert.equal(adaptiveGpsPolicy({}, {}).sendIntervalMs, 12000);
  assert.equal(adaptiveGpsPolicy({ distanceToNextStopMeters: 400 }, {}).sendIntervalMs, 7000);
  assert.equal(adaptiveGpsPolicy({ stationaryDurationMs: 30000 }, {}).sendIntervalMs, 30000);
  assert.equal(adaptiveGpsPolicy({}, {}).collectionIntervalMs, 5000);
});

test('trip lifecycle and recovery reasons transmit immediately', () => {
  for (const reason of ['TRIP_START', 'TRIP_END', 'RECONNECT', 'GPS_RECOVERED']) {
    const policy = adaptiveGpsPolicy({ reason }, {});
    assert.equal(policy.mode, 'IMMEDIATE');
    assert.equal(shouldTransmit(new Date(), new Date(), policy), true);
  }
  const policy = adaptiveGpsPolicy({}, {});
  assert.equal(shouldTransmit(new Date('2026-09-09T00:00:00Z'), new Date('2026-09-09T00:00:11Z'), policy), false);
  assert.equal(shouldTransmit(new Date('2026-09-09T00:00:00Z'), new Date('2026-09-09T00:00:12Z'), policy), true);
});
