const { test } = require('node:test');
const assert = require('assert').strict;
const {
  GoogleMapsGeometryError,
  requestRouteGeometry,
} = require('../src/lib/googleMapsGeometry');

const VALID_STOPS = [
  { id: 101, sequenceOrder: 1, latitude: 17.1, longitude: 78.1 },
  { id: 102, sequenceOrder: 2, latitude: 17.2, longitude: 78.2 },
];

test('Google Routes API geometry returns a persisted polyline contract without exposing the key', async () => {
  let requestedUrl = null;
  let requestedHeaders = null;
  let requestedBody = null;

  const mockFetch = async (url, options) => {
    requestedUrl = url;
    requestedHeaders = options.headers;
    requestedBody = JSON.parse(options.body);
    return {
      ok: true,
      json: async () => ({
        routes: [
          {
            distanceMeters: 5000,
            duration: "600s",
            polyline: {
              encodedPolyline: 'mock_polyline_data'
            }
          }
        ]
      })
    };
  };

  const result = await requestRouteGeometry(VALID_STOPS, {
    apiKey: 'secret-key-123',
    fetchImpl: mockFetch,
  });

  assert.equal(requestedUrl.toString(), 'https://routes.googleapis.com/directions/v2:computeRoutes');
  assert.equal(requestedHeaders['X-Goog-Api-Key'], 'secret-key-123');
  assert.equal(requestedHeaders['X-Goog-FieldMask'], 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline');
  assert.equal(requestedBody.origin.location.latLng.latitude, 17.1);
  assert.equal(requestedBody.destination.location.latLng.latitude, 17.2);
  
  assert.equal(result.geometryPolyline, 'mock_polyline_data');
  assert.equal(result.geometryDistanceMeters, 5000);
  assert.equal(result.geometryDurationSeconds, 600);
  assert.equal(result.geometryFormat, 'polyline5');
  assert.equal(result.geometryProvider, 'GOOGLE_ROUTES_API');
  
  // Exposes no key in the returned data
  assert.ok(!JSON.stringify(result).includes('secret-key'));
});

test('Google Routes API failures use safe codes and never include the credential', async () => {
  const mockFetch = async () => ({
    ok: false,
    status: 403,
  });

  try {
    await requestRouteGeometry(VALID_STOPS, {
      apiKey: 'secret-key-123',
      fetchImpl: mockFetch,
    });
    assert.fail('Should have thrown an error');
  } catch (error) {
    assert.ok(error instanceof GoogleMapsGeometryError);
    assert.equal(error.code, 'HTTP_403');
    assert.ok(!error.message.includes('secret-key'));
  }
});
