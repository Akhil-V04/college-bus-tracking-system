const prisma = require('./prisma');
const haversineDistance = require('./haversine');

// Default assumed bus speed (km/h) when there isn't enough history to measure.
// 25 km/h ≈ average urban bus speed including stops at signals/stops.
const DEFAULT_SPEED_KMH = 25;
// Cap measured speed to reject GPS spikes (e.g. a one-off 200 km/h glitch).
const MAX_SPEED_KMH = 90;
// How many recent fixes to use when estimating the rolling average speed.
const LOCATION_HISTORY = 10;

// Predicts the arrival time at every remaining stop of a running trip.
//
// The model: a bus travels along a route made of ordered stops. We know the
// bus's current position (latest LiveLocation) and we estimate its average
// speed from the most recent GPS fixes (total distance travelled / total time
// elapsed — this automatically absorbs dwell time at stops and traffic). The
// distance from the current position to each remaining stop is measured along
// the route (straight line between consecutive stops), and ETA = distance /
// speed. No machine learning needed — a moving average is accurate enough for
// "your bus arrives in ~12 minutes".
async function estimateArrival(tripId) {
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: {
      bus: {
        include: {
          route: {
            include: {
              routeStops: {
                orderBy: { sequenceOrder: 'asc' },
                include: { stop: true },
              },
            },
          },
        },
      },
    },
  });
  if (!trip) return null;

  const latest = await prisma.liveLocation.findFirst({
    where: { tripId },
    orderBy: { timestamp: 'desc' },
  });
  const routeStops = trip.bus.route.routeStops;

  if (!latest) {
    return { tripId, currentStopIndex: -1, speedKmh: null, atDestination: false, stops: [] };
  }

  const currentStopIndex = latest.currentStopIndex ?? 0;

  // The bus has passed the last stop — it is at (or past) the destination.
  if (currentStopIndex >= routeStops.length) {
    return { tripId, currentStopIndex, speedKmh: null, atDestination: true, stops: [] };
  }

  const speedKmh = await estimateSpeed(tripId);

  // Walking the route from the bus's current position, accumulate the distance
  // to each remaining stop.
  const stops = [];
  let cumulativeKm =
    haversineDistance(
      latest.latitude,
      latest.longitude,
      routeStops[currentStopIndex].stop.latitude,
      routeStops[currentStopIndex].stop.longitude
    ) / 1000;

  for (let i = currentStopIndex; i < routeStops.length; i++) {
    if (i > currentStopIndex) {
      cumulativeKm +=
        haversineDistance(
          routeStops[i - 1].stop.latitude,
          routeStops[i - 1].stop.longitude,
          routeStops[i].stop.latitude,
          routeStops[i].stop.longitude
        ) / 1000;
    }
    const etaMinutes = speedKmh > 0 ? Math.round((cumulativeKm / speedKmh) * 60) : null;
    stops.push({
      index: i,
      stopId: routeStops[i].stop.id,
      name: routeStops[i].stop.name,
      latitude: routeStops[i].stop.latitude,
      longitude: routeStops[i].stop.longitude,
      scheduledTime: routeStops[i].scheduledTime,
      distanceKm: Math.round(cumulativeKm * 100) / 100,
      etaMinutes,
    });
  }

  return { tripId, currentStopIndex, speedKmh, atDestination: false, stops };
}

// Rolling average speed from the last few GPS fixes (distance / time). Falls
// back to DEFAULT_SPEED_KMH when there isn't enough clean data.
async function estimateSpeed(tripId) {
  const fixes = await prisma.liveLocation.findMany({
    where: { tripId },
    orderBy: { timestamp: 'asc' },
    take: LOCATION_HISTORY,
  });
  if (fixes.length < 2) return DEFAULT_SPEED_KMH;

  let totalMeters = 0;
  let totalMs = 0;
  for (let i = 1; i < fixes.length; i++) {
    const d = haversineDistance(
      fixes[i - 1].latitude,
      fixes[i - 1].longitude,
      fixes[i].latitude,
      fixes[i].longitude
    );
    const t =
      new Date(fixes[i].timestamp).getTime() - new Date(fixes[i - 1].timestamp).getTime();
    if (t <= 0) continue; // duplicate timestamps
    if (d < 5) continue; // GPS jitter while stationary
    totalMeters += d;
    totalMs += t;
  }
  if (totalMeters <= 0 || totalMs <= 0) return DEFAULT_SPEED_KMH;

  const kmh = totalMeters / 1000 / (totalMs / 3600000);
  if (!Number.isFinite(kmh) || kmh <= 0) return DEFAULT_SPEED_KMH;
  return Math.min(kmh, MAX_SPEED_KMH);
}

module.exports = { estimateArrival, estimateSpeed };
