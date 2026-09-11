const crypto = require('crypto');

const DEFAULT_BASE_URL = 'https://route.mappls.com/route/direction';
const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_ROUTE_POINTS = 50;

class MapplsGeometryError extends Error {
  constructor(code, message, statusCode = 502) {
    super(message);
    this.name = 'MapplsGeometryError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeRoutePoints(stops) {
  if (!Array.isArray(stops) || stops.length < 2) {
    throw new MapplsGeometryError('INSUFFICIENT_POINTS', 'At least two ordered stops are required', 400);
  }
  if (stops.length > MAX_ROUTE_POINTS) {
    throw new MapplsGeometryError('TOO_MANY_POINTS', `Route geometry supports at most ${MAX_ROUTE_POINTS} points`, 400);
  }
  return stops.map((entry) => {
    const stop = entry.stop || entry;
    const latitude = Number(stop.latitude);
    const longitude = Number(stop.longitude);
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
        !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      throw new MapplsGeometryError('INVALID_POINT', 'Route contains an invalid stop coordinate', 400);
    }
    return {
      id: Number(entry.stopId || stop.id || 0),
      sequenceOrder: Number(entry.sequenceOrder || 0),
      latitude,
      longitude,
    };
  });
}

function routeGeometryFingerprint(stops) {
  const points = normalizeRoutePoints(stops);
  const canonical = points
    .map((point) => `${point.id}:${point.sequenceOrder}:${point.longitude.toFixed(6)},${point.latitude.toFixed(6)}`)
    .join(';');
  return crypto.createHash('sha256').update(canonical, 'utf8').digest('hex');
}

function safeProviderCode(value) {
  const normalized = String(value || 'UNKNOWN').toUpperCase().replace(/[^A-Z0-9_-]/g, '_');
  return normalized.slice(0, 80) || 'UNKNOWN';
}

async function requestRouteGeometry(stops, options = {}) {
  const points = normalizeRoutePoints(stops);
  const accessToken = options.accessToken === undefined
    ? process.env.MAPPLS_ACCESS_TOKEN
    : options.accessToken;
  if (!accessToken || !String(accessToken).trim()) {
    throw new MapplsGeometryError('NOT_CONFIGURED', 'Mappls route geometry is not configured', 503);
  }

  const baseUrl = String(options.baseUrl || process.env.MAPPLS_ROUTING_BASE_URL || DEFAULT_BASE_URL)
    .replace(/\/+$/, '');
  if (!/^https:\/\//i.test(baseUrl)) {
    throw new MapplsGeometryError('INVALID_BASE_URL', 'Mappls routing base URL must use HTTPS', 500);
  }
  const coordinates = points.map((point) => `${point.longitude},${point.latitude}`).join(';');
  const url = new URL(`${baseUrl}/route_adv/driving/${coordinates}`);
  url.searchParams.set('steps', 'false');
  url.searchParams.set('rtype', '0');
  url.searchParams.set('overview', 'full');
  url.searchParams.set('geometries', 'polyline');
  url.searchParams.set('access_token', String(accessToken).trim());

  const timeoutMs = positiveInteger(
    options.timeoutMs || process.env.MAPPLS_REQUEST_TIMEOUT_MS,
    DEFAULT_TIMEOUT_MS
  );
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  timeout.unref?.();

  try {
    const response = await (options.fetchImpl || fetch)(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new MapplsGeometryError(`HTTP_${response.status}`, 'Mappls route geometry request failed');
    }
    let body;
    try {
      body = await response.json();
    } catch (_error) {
      throw new MapplsGeometryError('INVALID_RESPONSE', 'Mappls returned an invalid route response');
    }
    if (String(body?.code || '').toLowerCase() !== 'ok') {
      throw new MapplsGeometryError(
        `PROVIDER_${safeProviderCode(body?.code)}`,
        'Mappls could not generate route geometry'
      );
    }
    const route = body.routes?.[0];
    if (!route || typeof route.geometry !== 'string' || !route.geometry.length) {
      throw new MapplsGeometryError('NO_GEOMETRY', 'Mappls returned no route geometry');
    }
    return {
      geometryPolyline: route.geometry,
      geometryFormat: 'polyline5',
      geometryDistanceMeters: Number.isFinite(Number(route.distance)) ? Number(route.distance) : null,
      geometryDurationSeconds: Number.isFinite(Number(route.duration)) ? Number(route.duration) : null,
      geometryGeneratedAt: new Date(),
      geometryFingerprint: routeGeometryFingerprint(stops),
      geometryProvider: 'MAPPLS',
      geometryErrorCode: null,
    };
  } catch (error) {
    if (error instanceof MapplsGeometryError) throw error;
    if (error?.name === 'AbortError') {
      throw new MapplsGeometryError('TIMEOUT', 'Mappls route geometry request timed out');
    }
    throw new MapplsGeometryError('UNAVAILABLE', 'Mappls route geometry is temporarily unavailable');
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = {
  DEFAULT_BASE_URL,
  DEFAULT_TIMEOUT_MS,
  MAX_ROUTE_POINTS,
  MapplsGeometryError,
  normalizeRoutePoints,
  requestRouteGeometry,
  routeGeometryFingerprint,
  safeProviderCode,
};
