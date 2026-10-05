const test = require('node:test');
const assert = require('node:assert/strict');

const { parseNearbyQuery, rankNearestStops } = require('../src/routes/passenger');

test('nearest-stop query validates bounds without retaining coordinates', () => {
  assert.deepEqual(parseNearbyQuery({ latitude: '12.97', longitude: '77.59' }), {
    latitude: 12.97,
    longitude: 77.59,
    radiusMeters: 10000,
    limit: 10,
  });
  assert.equal(parseNearbyQuery({ latitude: '91', longitude: '77.59' }), null);
  assert.equal(parseNearbyQuery({ latitude: '12.97', longitude: '77.59', limit: '21' }), null);
});

test('nearest stored stops are deterministic and radius-limited', () => {
  const stops = [
    { id: 2, name: 'Far', latitude: 13.2, longitude: 77.59 },
    { id: 3, name: 'Second', latitude: 12.971, longitude: 77.59 },
    { id: 1, name: 'Nearest', latitude: 12.9701, longitude: 77.59 },
  ];
  const ranked = rankNearestStops(stops, {
    latitude: 12.97,
    longitude: 77.59,
    radiusMeters: 1000,
    limit: 2,
  });
  assert.deepEqual(ranked.map((stop) => stop.id), [1, 3]);
  assert.ok(ranked[0].distanceMeters < ranked[1].distanceMeters);
});
