const prisma = require('./prisma');
const haversineDistance = require('./haversine');

const DEFAULT_SPEED_KMH = 25;
const MAX_SPEED_KMH = 90;
const LOCATION_HISTORY = 10;
const AT_STOP_METERS = 150;
const STALE_AFTER_MS = 2 * 60 * 1000;

async function estimateSpeed(tripId) {
  const newestFirst = await prisma.liveLocation.findMany({
    where: { tripId, acceptedForEta: true },
    orderBy: { receivedAt: 'desc' },
    take: LOCATION_HISTORY,
  });
  const fixes = newestFirst.reverse();
  if (fixes.length < 2) return { speedKmh: DEFAULT_SPEED_KMH, confidence: 'LOW' };

  let totalMeters = 0;
  let totalMs = 0;
  for (let index = 1; index < fixes.length; index += 1) {
    const distance = haversineDistance(
      fixes[index - 1].latitude,
      fixes[index - 1].longitude,
      fixes[index].latitude,
      fixes[index].longitude
    );
    const elapsed = new Date(fixes[index].receivedAt) - new Date(fixes[index - 1].receivedAt);
    if (elapsed <= 0 || distance < 5) continue;
    const segmentKmh = distance / 1000 / (elapsed / 3600000);
    if (segmentKmh > MAX_SPEED_KMH) continue;
    totalMeters += distance;
    totalMs += elapsed;
  }

  if (!totalMeters || !totalMs) return { speedKmh: DEFAULT_SPEED_KMH, confidence: 'LOW' };
  const speedKmh = Math.min(totalMeters / 1000 / (totalMs / 3600000), MAX_SPEED_KMH);
  return { speedKmh, confidence: fixes.length >= 5 ? 'HIGH' : 'MEDIUM' };
}

function etaRange(minutes, confidence) {
  const ratio = confidence === 'HIGH' ? 0.15 : confidence === 'MEDIUM' ? 0.25 : 0.4;
  const margin = Math.max(2, Math.ceil(minutes * ratio));
  return { min: Math.max(0, Math.floor(minutes - margin)), max: Math.ceil(minutes + margin) };
}

async function estimateArrival(tripId, selectedStopId = null) {
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: {
      scheduleVersion: {
        include: {
          stops: { orderBy: { sequenceOrder: 'asc' }, include: { stop: true } },
        },
      },
      stopEvents: true,
    },
  });
  if (!trip) return null;

  const stops = trip.scheduleVersion.stops;
  const selectedIndex =
    selectedStopId == null ? null : stops.findIndex((item) => item.stopId === Number(selectedStopId));
  if (selectedStopId != null && selectedIndex < 0) {
    return { status: 'INVALID_STOP', message: 'Selected stop does not belong to this route' };
  }

  if (trip.status === 'COMPLETED' || trip.status === 'CANCELLED') {
    return {
      tripId,
      status: 'TRIP_ENDED',
      message: trip.status === 'COMPLETED' ? 'Today\'s trip has ended' : 'Today\'s trip was cancelled',
      updatedAt: trip.endTime || trip.updatedAt,
    };
  }
  if (trip.status !== 'RUNNING') {
    return { tripId, status: 'NOT_STARTED', message: 'The driver has not started this trip' };
  }

  const latest = await prisma.liveLocation.findFirst({
    where: { tripId, acceptedForEta: true },
    orderBy: { receivedAt: 'desc' },
  });
  if (!latest) {
    return { tripId, status: 'NO_LIVE_DATA', message: 'Live location is not available yet' };
  }

  const stale = Date.now() - new Date(latest.receivedAt).getTime() > STALE_AFTER_MS;
  if (stale) {
    return {
      tripId,
      status: 'NO_LIVE_DATA',
      message: 'Live location is temporarily unavailable',
      updatedAt: latest.receivedAt,
    };
  }

  const currentIndex = Math.min(trip.currentStopIndex, stops.length);
  if (selectedIndex != null && selectedIndex < currentIndex) {
    const event = trip.stopEvents.find((item) => item.scheduleStopId === stops[selectedIndex].id);
    return {
      tripId,
      stopId: Number(selectedStopId),
      status: event?.status === 'POSSIBLY_SKIPPED' ? 'POSSIBLY_SKIPPED' : 'PASSED',
      message:
        event?.status === 'POSSIBLY_SKIPPED'
          ? 'Bus appears to have passed this stop without a confirmed stop'
          : 'Bus has already passed this stop',
      passedAt: event?.detectedAt || null,
      updatedAt: latest.receivedAt,
      etaMinutes: null,
    };
  }

  if (currentIndex >= stops.length) {
    return { tripId, status: 'TRIP_ENDED', message: 'Bus has reached the final stop', updatedAt: latest.receivedAt };
  }

  if (selectedIndex === currentIndex) {
    const selected = stops[selectedIndex].stop;
    const distance = haversineDistance(latest.latitude, latest.longitude, selected.latitude, selected.longitude);
    if (distance <= AT_STOP_METERS) {
      return {
        tripId,
        stopId: selected.id,
        status: 'AT_STOP',
        message: 'Bus is currently at or near this stop',
        distanceMeters: Math.round(distance),
        updatedAt: latest.receivedAt,
      };
    }
  }

  const { speedKmh, confidence } = await estimateSpeed(tripId);
  const stopResults = [];
  let cumulativeKm =
    haversineDistance(
      latest.latitude,
      latest.longitude,
      stops[currentIndex].stop.latitude,
      stops[currentIndex].stop.longitude
    ) / 1000;

  for (let index = currentIndex; index < stops.length; index += 1) {
    if (index > currentIndex) {
      cumulativeKm +=
        haversineDistance(
          stops[index - 1].stop.latitude,
          stops[index - 1].stop.longitude,
          stops[index].stop.latitude,
          stops[index].stop.longitude
        ) / 1000;
    }
    const minutes = Math.max(0, Math.round((cumulativeKm / speedKmh) * 60));
    stopResults.push({
      stopId: stops[index].stop.id,
      name: stops[index].stop.name,
      scheduledTime: stops[index].scheduledTime,
      status: index === currentIndex ? 'ARRIVING' : 'UPCOMING',
      distanceKm: Math.round(cumulativeKm * 100) / 100,
      etaMinutes: minutes,
      etaRangeMinutes: etaRange(minutes, confidence),
    });
  }

  if (selectedIndex != null) {
    const selected = stopResults.find((item) => item.stopId === Number(selectedStopId));
    return {
      tripId,
      status: selected.status,
      message: 'Estimated arrival is based on recent live movement',
      confidence,
      speedKmh: Math.round(speedKmh * 10) / 10,
      updatedAt: latest.receivedAt,
      ...selected,
    };
  }

  return {
    tripId,
    status: 'UPCOMING',
    currentStopIndex: currentIndex,
    confidence,
    speedKmh: Math.round(speedKmh * 10) / 10,
    updatedAt: latest.receivedAt,
    stops: stopResults,
  };
}

module.exports = {
  estimateArrival,
  estimateSpeed,
  etaRange,
  DEFAULT_SPEED_KMH,
  MAX_SPEED_KMH,
  STALE_AFTER_MS,
};
