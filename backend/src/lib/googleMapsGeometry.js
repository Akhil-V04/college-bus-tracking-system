const crypto = require('crypto');

const DEFAULT_BASE_URL = 'https://maps.googleapis.com/maps/api/directions/json';
const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_ROUTE_POINTS = 27; // 1 origin + 1 destination + 25 waypoints max for basic Google Maps API

class GoogleMapsGeometryError extends Error {
  constructor(code, message, statusCode = 502) {
    super(message);
    this.name = 'GoogleMapsGeometryError';
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
    throw new GoogleMapsGeometryError('INSUFFICIENT_POINTS', 'At least two ordered stops are required', 400);
  }
  if (stops.length > MAX_ROUTE_POINTS) {
    throw new GoogleMapsGeometryError('TOO_MANY_POINTS', `Route geometry supports at most ${MAX_ROUTE_POINTS} points`, 400);
  }
  return stops.map((entry) => {
    const stop = entry.stop || entry;
    const latitude = Number(stop.latitude);
    const longitude = Number(stop.longitude);
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
        !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      throw new GoogleMapsGeometryError('INVALID_POINT', 'Route contains an invalid stop coordinate', 400);
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
  const apiKey = options.apiKey === undefined
    ? process.env.BACKEND_GOOGLE_MAPS_API_KEY
    : options.apiKey;
    
  if (!apiKey || !String(apiKey).trim()) {
    throw new GoogleMapsGeometryError('NOT_CONFIGURED', 'Google Maps route geometry is not configured', 503);
  }

  const baseUrl = String(options.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '');
  const url = new URL(baseUrl);
  
  const origin = points[0];
  const destination = points[points.length - 1];
  
  url.searchParams.set('origin', `${origin.latitude},${origin.longitude}`);
  url.searchParams.set('destination', `${destination.latitude},${destination.longitude}`);
  
  if (points.length > 2) {
    const waypoints = points.slice(1, -1)
      .map(p => `${p.latitude},${p.longitude}`)
      .join('|');
    url.searchParams.set('waypoints', waypoints);
  }
  
  url.searchParams.set('key', String(apiKey).trim());

  const timeoutMs = positiveInteger(
    options.timeoutMs || process.env.GOOGLE_MAPS_REQUEST_TIMEOUT_MS,
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
      throw new GoogleMapsGeometryError(`HTTP_${response.status}`, 'Google Maps route geometry request failed');
    }
    
    let body;
    try {
      body = await response.json();
    } catch (_error) {
      throw new GoogleMapsGeometryError('INVALID_RESPONSE', 'Google Maps returned an invalid route response');
    }
    
    if (body.status !== 'OK') {
      throw new GoogleMapsGeometryError(
        `PROVIDER_${safeProviderCode(body.status)}`,
        'Google Maps could not generate route geometry'
      );
    }
    
    const route = body.routes?.[0];
    if (!route || !route.overview_polyline || !route.overview_polyline.points) {
      throw new GoogleMapsGeometryError('NO_GEOMETRY', 'Google Maps returned no route geometry');
    }
    
    let totalDistance = 0;
    let totalDuration = 0;
    if (route.legs) {
      for (const leg of route.legs) {
        if (leg.distance?.value) totalDistance += leg.distance.value;
        if (leg.duration?.value) totalDuration += leg.duration.value;
      }
    }

    return {
      geometryPolyline: route.overview_polyline.points,
      geometryFormat: 'polyline5',
      geometryDistanceMeters: totalDistance > 0 ? totalDistance : null,
      geometryDurationSeconds: totalDuration > 0 ? totalDuration : null,
      geometryGeneratedAt: new Date(),
      geometryFingerprint: routeGeometryFingerprint(stops),
      geometryProvider: 'GOOGLE',
      geometryErrorCode: null,
    };
  } catch (error) {
    if (error instanceof GoogleMapsGeometryError) throw error;
    if (error?.name === 'AbortError') {
      throw new GoogleMapsGeometryError('TIMEOUT', 'Google Maps route geometry request timed out');
    }
    throw new GoogleMapsGeometryError('UNAVAILABLE', 'Google Maps route geometry is temporarily unavailable');
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = {
  DEFAULT_BASE_URL,
  DEFAULT_TIMEOUT_MS,
  MAX_ROUTE_POINTS,
  GoogleMapsGeometryError,
  normalizeRoutePoints,
  requestRouteGeometry,
  routeGeometryFingerprint,
  safeProviderCode,
};
