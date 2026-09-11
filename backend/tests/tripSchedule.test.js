const test = require('node:test');
const assert = require('node:assert/strict');

const { operationalStops } = require('../src/lib/tripSchedule');

test('running trip operations prefer captured schedule coordinates over edited master data', () => {
  const trip = {
    scheduleSnapshot: { stops: [{
      scheduleStopId: 7, stopId: 2, sequenceOrder: 0, scheduledTime: '08:00',
      name: 'Captured', latitude: 12.1, longitude: 77.1,
    }] },
    scheduleVersion: { stops: [{ id: 7, stopId: 2, stop: { name: 'Edited', latitude: 13, longitude: 78 } }] },
  };
  const stops = operationalStops(trip);
  assert.equal(stops[0].stop.name, 'Captured');
  assert.equal(stops[0].stop.latitude, 12.1);
});
