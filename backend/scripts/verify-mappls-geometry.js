require('dotenv').config();

const { MapplsGeometryError, requestRouteGeometry } = require('../src/lib/mapplsGeometry');

async function main() {
  const geometry = await requestRouteGeometry([
    { stopId: 900001, sequenceOrder: 0, latitude: 12.9716, longitude: 77.5946 },
    { stopId: 900002, sequenceOrder: 1, latitude: 12.9352, longitude: 77.6245 },
  ]);
  console.log(JSON.stringify({
    provider: geometry.geometryProvider,
    format: geometry.geometryFormat,
    polylineCharacters: geometry.geometryPolyline.length,
    distanceMeters: geometry.geometryDistanceMeters == null ? null : Math.round(geometry.geometryDistanceMeters),
    durationSeconds: geometry.geometryDurationSeconds == null ? null : Math.round(geometry.geometryDurationSeconds),
    fingerprintPresent: Boolean(geometry.geometryFingerprint),
  }));
}

main().catch((error) => {
  const code = error instanceof MapplsGeometryError ? error.code : 'UNEXPECTED';
  console.error(JSON.stringify({ provider: 'MAPPLS', ok: false, code }));
  process.exitCode = 1;
});
