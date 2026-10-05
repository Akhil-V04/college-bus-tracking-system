const crypto = require('crypto');

const DEFAULT_BASE_URL = 'https://routes.googleapis.com/directions/v2:computeRoutes';
const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_ROUTE_POINTS = 27; // 1 origin + 1 destination + 25 intermediate waypoints

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

function pointToLocation(point) {
  return { location: { latLng: { latitude: point.latitude, longitude: point.longitude } } };
}

async function requestRouteGeometry(stops, options = {}) {
  const points = normalizeRoutePoints(stops);
  const apiKey = options.apiKey === undefined
    ? process.env.BACKEND_GOOGLE_MAPS_API_KEY
    : options.apiKey;
    
  if (!apiKey || !String(apiKey).trim()) {
    throw new GoogleMapsGeometryError('NOT_CONFIGURED', 'Google Maps route geometry is not configured', 503);
  }

  const url = String(options.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '');
  
  const payload = {
    origin: pointToLocation(points[0]),
    destination: pointToLocation(points[points.length - 1]),
    travelMode: 'DRIVE',
    polylineQuality: 'HIGH_QUALITY',
  };
  
  if (points.length > 2) {
    payload.intermediates = points.slice(1, -1).map(pointToLocation);
  }
  
  const timeoutMs = positiveInteger(
    options.timeoutMs || process.env.GOOGLE_MAPS_REQUEST_TIMEOUT_MS,
    DEFAULT_TIMEOUT_MS
  );
  
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  timeout.unref?.();

  try {
    const response = await (options.fetchImpl || fetch)(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': String(apiKey).trim(),
        'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline',
      },
      body: JSON.stringify(payload),
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
    
    const route = body.routes?.[0];
    if (!route || !route.polyline || !route.polyline.encodedPolyline) {
      throw new GoogleMapsGeometryError('NO_GEOMETRY', 'Google Maps returned no route geometry');
    }

    return {
      geometryPolyline: route.polyline.encodedPolyline,
      geometryFormat: 'polyline5',
      geometryDistanceMeters: typeof route.distanceMeters === 'number' ? route.distanceMeters : null,
      geometryDurationSeconds: typeof route.duration === 'string' ? parseInt(route.duration, 10) : null,
      geometryGeneratedAt: new Date(),
      geometryFingerprint: routeGeometryFingerprint(stops),
      geometryProvider: 'GOOGLE_ROUTES_API',
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
