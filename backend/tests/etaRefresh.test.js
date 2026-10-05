const test = require('node:test');
const assert = require('node:assert/strict');

const { etaIntervalMs, isEtaRefreshDue } = require('../src/lib/etaRefresh');

test('ETA refresh interval stays inside the 15-30 second contract', () => {
  assert.equal(etaIntervalMs({ ETA_RECALC_INTERVAL_MS: '15000' }), 15000);
  assert.equal(etaIntervalMs({ ETA_RECALC_INTERVAL_MS: '30000' }), 30000);
  assert.equal(etaIntervalMs({ ETA_RECALC_INTERVAL_MS: '5000' }), 20000);
});

test('ETA refresh is time-throttled but route transitions invalidate the cache', () => {
  const now = new Date('2026-09-09T10:00:20.000Z');
  const env = { ETA_RECALC_INTERVAL_MS: '20000' };
  assert.equal(isEtaRefreshDue(new Date('2026-09-09T10:00:05.000Z'), false, now, env), false);
  assert.equal(isEtaRefreshDue(new Date('2026-09-09T10:00:00.000Z'), false, now, env), true);
  assert.equal(isEtaRefreshDue(new Date('2026-09-09T10:00:19.000Z'), true, now, env), true);
});
