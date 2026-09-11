const test = require('node:test');
const assert = require('node:assert/strict');

const { assistanceAcceptanceOutcome, locationSnapshot, parseReport } = require('../src/routes/emergencies');

test('emergency input accepts only active-trip categories and bounded text', () => {
  assert.deepEqual(parseReport({ tripId: 3, category: 'accident', description: ' Help ' }), {
    tripId: 3, category: 'ACCIDENT', description: 'Help',
  });
  assert.equal(parseReport({ tripId: 0, category: 'ACCIDENT' }), null);
  assert.equal(parseReport({ tripId: 3, category: 'OTHER' }), null);
});

test('incident location uses only fresh accepted bus GPS and states uncertainty honestly', () => {
  const now = new Date('2026-09-09T10:05:00Z');
  assert.equal(locationSnapshot(null, now).source, 'NO_ACCEPTED_GPS');
  const stale = locationSnapshot({ latitude: 1, longitude: 2, receivedAt: new Date('2026-09-09T10:00:00Z') }, now);
  assert.equal(stale.source, 'STALE_ACCEPTED_GPS');
  assert.equal(stale.latitude, null);
  const fresh = locationSnapshot({ latitude: 1, longitude: 2, accuracyMeters: 20, receivedAt: new Date('2026-09-09T10:04:30Z') }, now);
  assert.equal(fresh.source, 'ACCEPTED_GPS_HIGH_CONFIDENCE');
  assert.equal(fresh.latitude, 1);
});

test('only one assistance offer can produce the accepted side effects', () => {
  assert.equal(assistanceAcceptanceOutcome('ASSISTANCE_REQUESTED', 'OFFERED'), 'ACCEPT');
  assert.equal(assistanceAcceptanceOutcome('ASSISTANCE_ACCEPTED', 'CLOSED'), 'CONFLICT');
  assert.equal(assistanceAcceptanceOutcome('ASSISTANCE_ACCEPTED', 'ACCEPTED'), 'DUPLICATE');
  assert.equal(assistanceAcceptanceOutcome('RESOLVED', 'OFFERED'), 'TERMINAL');
  assert.equal(assistanceAcceptanceOutcome('ASSISTANCE_REQUESTED', 'DECLINED'), 'CLOSED');
});
