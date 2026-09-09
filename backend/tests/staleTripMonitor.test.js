const test = require('node:test');
const assert = require('node:assert/strict');

const { monitorState } = require('../src/lib/staleTripMonitor');

const now = new Date('2026-08-25T04:30:00.000Z');

test('stale monitor gives new trips a GPS grace period and flags old missing data', () => {
  assert.equal(monitorState({ startTime: new Date(now - 30_000), latestLocationAt: null }, now), 'WAITING_FOR_GPS');
  assert.equal(monitorState({ startTime: new Date(now - 3 * 60_000), latestLocationAt: null }, now), 'NO_LIVE_DATA');
});

test('stale monitor distinguishes fresh and stale accepted locations', () => {
  assert.equal(
    monitorState({ startTime: new Date(now - 10 * 60_000), latestLocationAt: new Date(now - 20_000) }, now),
    'LIVE'
  );
  assert.equal(
    monitorState({ startTime: new Date(now - 10 * 60_000), latestLocationAt: new Date(now - 3 * 60_000) }, now),
    'STALE_LOCATION'
  );
});
