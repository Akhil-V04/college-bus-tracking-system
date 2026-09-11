const test = require('node:test');
const assert = require('node:assert/strict');

const {
  MapplsGeometryError,
  requestRouteGeometry,
  routeGeometryFingerprint,
} = require('../src/lib/mapplsGeometry');

const STOPS = [
  { stopId: 1, sequenceOrder: 0, stop: { latitude: 17.4435, longitude: 78.3772 } },
  { stopId: 2, sequenceOrder: 1, stop: { latitude: 17.4501, longitude: 78.3902 } },
];

test('Mappls geometry returns a persisted polyline contract without exposing the key', async () => {
  let requestedUrl;
  const result = await requestRouteGeometry(STOPS, {
    accessToken: 'synthetic-test-key',
    fetchImpl: async (url) => {
      requestedUrl = url;
      return {
        ok: true,
        async json() {
          return { code: 'Ok', routes: [{ geometry: 'encoded-line', distance: 1520.5, duration: 320.2 }] };
        },
      };
    },
  });

  assert.equal(requestedUrl.searchParams.get('access_token'), 'synthetic-test-key');
  assert.equal(requestedUrl.searchParams.get('geometries'), 'polyline');
  assert.equal(result.geometryPolyline, 'encoded-line');
  assert.equal(result.geometryFormat, 'polyline5');
  assert.equal(result.geometryProvider, 'MAPPLS');
  assert.equal(result.geometryDistanceMeters, 1520.5);
  assert.equal(result.geometryFingerprint, routeGeometryFingerprint(STOPS));
  assert.equal(JSON.stringify(result).includes('synthetic-test-key'), false);
});

test('Mappls failures use safe codes and never include the credential', async () => {
  await assert.rejects(
    requestRouteGeometry(STOPS, {
      accessToken: 'synthetic-secret-key',
      fetchImpl: async () => ({ ok: false, status: 403 }),
    }),
    (error) => {
      assert.ok(error instanceof MapplsGeometryError);
      assert.equal(error.code, 'HTTP_403');
      assert.equal(error.message.includes('synthetic-secret-key'), false);
      return true;
    }
  );
});

test('Mappls geometry validates route points before any provider call', async () => {
  let called = false;
  await assert.rejects(
    requestRouteGeometry([{ stopId: 1, stop: { latitude: 17.4, longitude: 78.4 } }], {
      accessToken: 'unused',
      fetchImpl: async () => { called = true; },
    }),
    (error) => error.code === 'INSUFFICIENT_POINTS'
  );
  assert.equal(called, false);
});
