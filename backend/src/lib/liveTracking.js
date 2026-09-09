const haversineDistance = require('./haversine');

const STOP_REACHED_METERS = 150;
const POSSIBLE_SKIP_NEAR_LATER_STOP_METERS = 500;
const OFF_ROUTE_THRESHOLD_METERS = 2000;
const MAX_ACCEPTED_SPEED_KMH = 120;
const MAX_LOCATION_AGE_MS = 5 * 60 * 1000;
const MAX_FUTURE_SKEW_MS = 2 * 60 * 1000;
const MAX_ACCURACY_METERS = 200;

function asDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function assessLocationSample({ sample, latestAccepted = null, latestDeviceTimestamp = null, now = new Date() }) {
  const deviceTimestamp = asDate(sample.deviceTimestamp);
  const nowMs = asDate(now).getTime();
  if (sample.accuracyMeters != null && sample.accuracyMeters > MAX_ACCURACY_METERS) {
    return { accepted: false, reason: 'POOR_ACCURACY' };
  }
  if (deviceTimestamp && nowMs - deviceTimestamp.getTime() > MAX_LOCATION_AGE_MS) {
    return { accepted: false, reason: 'DEVICE_TIMESTAMP_TOO_OLD' };
  }
  if (deviceTimestamp && deviceTimestamp.getTime() - nowMs > MAX_FUTURE_SKEW_MS) {
    return { accepted: false, reason: 'DEVICE_TIMESTAMP_IN_FUTURE' };
  }

  const previousDeviceTimestamp = asDate(latestDeviceTimestamp);
  if (deviceTimestamp && previousDeviceTimestamp) {
    if (deviceTimestamp.getTime() === previousDeviceTimestamp.getTime()) {
      return { accepted: false, reason: 'DUPLICATE_SAMPLE' };
    }
    if (deviceTimestamp < previousDeviceTimestamp) {
      return { accepted: false, reason: 'OUT_OF_ORDER_SAMPLE' };
    }
  }

  if (!latestAccepted) return { accepted: true, reason: null, calculatedSpeedKmh: null };
  const distanceMeters = haversineDistance(
    latestAccepted.latitude,
    latestAccepted.longitude,
    sample.latitude,
    sample.longitude
  );
  const latestDeviceTime = asDate(latestAccepted.deviceTimestamp);
  const latestReceivedAt = asDate(latestAccepted.receivedAt);
  const elapsedMs = deviceTimestamp && latestDeviceTime
    ? deviceTimestamp.getTime() - latestDeviceTime.getTime()
    : nowMs - latestReceivedAt.getTime();
  if (elapsedMs <= 0) return { accepted: false, reason: 'OUT_OF_ORDER_SAMPLE' };

  const calculatedSpeedKmh = distanceMeters / 1000 / (elapsedMs / 3_600_000);
  if (calculatedSpeedKmh > MAX_ACCEPTED_SPEED_KMH) {
    return { accepted: false, reason: 'IMPOSSIBLE_SPEED', calculatedSpeedKmh };
  }
  return { accepted: true, reason: null, calculatedSpeedKmh };
}

function toLocalMeters(latitude, longitude, originLatitude, originLongitude) {
  const earthRadius = 6_371_000;
  const x = (longitude - originLongitude) * Math.PI / 180 * earthRadius * Math.cos(originLatitude * Math.PI / 180);
  const y = (latitude - originLatitude) * Math.PI / 180 * earthRadius;
  return { x, y };
}

function pointToSegmentDistanceMeters(point, start, end) {
  const originLatitude = point.latitude;
  const originLongitude = point.longitude;
  const p = { x: 0, y: 0 };
  const a = toLocalMeters(start.latitude, start.longitude, originLatitude, originLongitude);
  const b = toLocalMeters(end.latitude, end.longitude, originLatitude, originLongitude);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (dx === 0 && dy === 0) return Math.hypot(a.x, a.y);
  const projection = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(p.x - (a.x + projection * dx), p.y - (a.y + projection * dy));
}

function stopCoordinates(entry) {
  return entry.stop || entry;
}

function distanceToRouteMeters(latitude, longitude, stops) {
  if (!stops.length) return null;
  const point = { latitude, longitude };
  if (stops.length === 1) {
    const stop = stopCoordinates(stops[0]);
    return haversineDistance(latitude, longitude, stop.latitude, stop.longitude);
  }
  let minimum = Infinity;
  for (let index = 1; index < stops.length; index += 1) {
    minimum = Math.min(
      minimum,
      pointToSegmentDistanceMeters(point, stopCoordinates(stops[index - 1]), stopCoordinates(stops[index]))
    );
  }
  return minimum;
}

function classifyRouteProgress({ latitude, longitude, stops, currentStopIndex }) {
  const currentIndex = Math.max(0, Math.min(Number(currentStopIndex) || 0, stops.length));
  const routeDistanceMeters = distanceToRouteMeters(latitude, longitude, stops);
  if (!stops.length || currentIndex >= stops.length) {
    return { state: 'ROUTE_COMPLETED', nextStopIndex: stops.length, events: [], routeDistanceMeters };
  }
  if (routeDistanceMeters != null && routeDistanceMeters > OFF_ROUTE_THRESHOLD_METERS) {
    return { state: 'OFF_ROUTE', nextStopIndex: currentIndex, events: [], routeDistanceMeters };
  }

  const remaining = stops.slice(currentIndex).map((entry, offset) => {
    const stop = stopCoordinates(entry);
    return {
      index: currentIndex + offset,
      distanceMeters: haversineDistance(latitude, longitude, stop.latitude, stop.longitude),
    };
  });
  const nearest = remaining.reduce((best, item) => item.distanceMeters < best.distanceMeters ? item : best);
  const events = [];
  let nextStopIndex = currentIndex;

  if (nearest.index === currentIndex && nearest.distanceMeters <= STOP_REACHED_METERS) {
    events.push({ index: currentIndex, status: 'REACHED' });
    nextStopIndex = currentIndex + 1;
  } else if (nearest.index > currentIndex && nearest.distanceMeters <= POSSIBLE_SKIP_NEAR_LATER_STOP_METERS) {
    for (let index = currentIndex; index < nearest.index; index += 1) {
      events.push({ index, status: 'POSSIBLY_SKIPPED' });
    }
    nextStopIndex = nearest.index;
    if (nearest.distanceMeters <= STOP_REACHED_METERS) {
      events.push({ index: nearest.index, status: 'REACHED' });
      nextStopIndex = nearest.index + 1;
    }
  }

  return {
    state: nextStopIndex >= stops.length ? 'ROUTE_COMPLETED' : 'ON_ROUTE',
    nextStopIndex,
    events,
    routeDistanceMeters,
  };
}

function locationFreshness(receivedAt, now = new Date(), staleAfterMs = 2 * 60 * 1000) {
  if (!receivedAt) return 'NO_LIVE_DATA';
  return asDate(now).getTime() - asDate(receivedAt).getTime() > staleAfterMs ? 'STALE_LOCATION' : 'LIVE';
}

module.exports = {
  MAX_ACCEPTED_SPEED_KMH,
  MAX_ACCURACY_METERS,
  MAX_FUTURE_SKEW_MS,
  MAX_LOCATION_AGE_MS,
  OFF_ROUTE_THRESHOLD_METERS,
  POSSIBLE_SKIP_NEAR_LATER_STOP_METERS,
  STOP_REACHED_METERS,
  assessLocationSample,
  classifyRouteProgress,
  distanceToRouteMeters,
  locationFreshness,
  pointToSegmentDistanceMeters,
};
