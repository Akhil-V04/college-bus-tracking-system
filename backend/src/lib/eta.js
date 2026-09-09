const prisma = require('./prisma');
const haversineDistance = require('./haversine');
const {
  OFF_ROUTE_THRESHOLD_METERS,
  STOP_REACHED_METERS,
  distanceToRouteMeters,
  locationFreshness,
} = require('./liveTracking');

const DEFAULT_SPEED_KMH = 25;
const MAX_SPEED_KMH = 90;
const LOCATION_HISTORY = 10;
const STALE_AFTER_MS = 2 * 60 * 1000;
const STATIONARY_MIN_SPAN_MS = 30 * 1000;
const STATIONARY_MAX_DISTANCE_METERS = 10;

async function estimateSpeed(tripId) {
  const newestFirst = await prisma.liveLocation.findMany({
    where: { tripId, acceptedForEta: true },
    orderBy: { receivedAt: 'desc' },
    take: LOCATION_HISTORY,
  });
  const fixes = newestFirst.reverse();
  if (fixes.length < 2) {
    return { speedKmh: DEFAULT_SPEED_KMH, confidence: 'LOW', moving: null };
  }

  let totalMeters = 0;
  let totalMs = 0;
  let observationSpanMs = 0;
  for (let index = 1; index < fixes.length; index += 1) {
    const elapsed = new Date(fixes[index].receivedAt) - new Date(fixes[index - 1].receivedAt);
    if (elapsed <= 0) continue;
    observationSpanMs += elapsed;
    const distance = haversineDistance(
      fixes[index - 1].latitude,
      fixes[index - 1].longitude,
      fixes[index].latitude,
      fixes[index].longitude
    );
    if (distance < 5) continue;
    const segmentKmh = distance / 1000 / (elapsed / 3_600_000);
    if (segmentKmh > MAX_SPEED_KMH) continue;
    totalMeters += distance;
    totalMs += elapsed;
  }

  if (observationSpanMs >= STATIONARY_MIN_SPAN_MS && totalMeters < STATIONARY_MAX_DISTANCE_METERS) {
    return { speedKmh: 0, confidence: 'LOW', moving: false };
  }
  if (!totalMeters || !totalMs) {
    return { speedKmh: DEFAULT_SPEED_KMH, confidence: 'LOW', moving: null };
  }
  const speedKmh = Math.min(totalMeters / 1000 / (totalMs / 3_600_000), MAX_SPEED_KMH);
  return { speedKmh, confidence: fixes.length >= 5 ? 'HIGH' : 'MEDIUM', moving: true };
}

function etaRange(minutes, confidence) {
  const ratio = confidence === 'HIGH' ? 0.15 : confidence === 'MEDIUM' ? 0.25 : 0.4;
  const margin = Math.max(2, Math.ceil(minutes * ratio));
  return { min: Math.max(0, Math.floor(minutes - margin)), max: Math.ceil(minutes + margin) };
}

function passedStopResult(tripId, selectedStopId, event, latest) {
  const possiblySkipped = event?.status === 'POSSIBLY_SKIPPED';
  return {
    tripId,
    stopId: Number(selectedStopId),
    status: possiblySkipped ? 'POSSIBLY_SKIPPED' : 'PASSED',
    message: possiblySkipped
      ? 'Bus appears to have passed this stop without a confirmed arrival'
      : 'Bus has already passed this stop',
    passedAt: event?.detectedAt || null,
    updatedAt: latest.receivedAt,
    etaMinutes: null,
    etaRangeMinutes: null,
  };
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
  const selectedSchedule = selectedIndex == null
    ? null
    : {
        stopId: stops[selectedIndex].stopId,
        name: stops[selectedIndex].stop.name,
        scheduledTime: stops[selectedIndex].scheduledTime,
      };
  if (!stops.length) {
    return { tripId, status: 'NO_SCHEDULE', message: 'This trip has no route stops' };
  }

  if (trip.status === 'COMPLETED' || trip.status === 'CANCELLED') {
    return {
      tripId,
      status: 'TRIP_ENDED',
      message: trip.status === 'COMPLETED' ? 'Today\'s trip has ended' : 'Today\'s trip was cancelled',
      updatedAt: trip.endTime || trip.updatedAt,
      etaMinutes: null,
    };
  }
  if (trip.status !== 'RUNNING') {
    return {
      tripId,
      status: 'NOT_STARTED',
      message: 'The driver has not started this trip; use the scheduled time as a fallback',
      scheduledTime: selectedSchedule?.scheduledTime || null,
      etaMinutes: null,
    };
  }

  const [latest, latestSample] = await Promise.all([
    prisma.liveLocation.findFirst({
      where: { tripId, acceptedForEta: true },
      orderBy: { receivedAt: 'desc' },
    }),
    prisma.liveLocation.findFirst({
      where: { tripId },
      orderBy: { receivedAt: 'desc' },
      select: { receivedAt: true, acceptedForEta: true, rejectionReason: true },
    }),
  ]);
  if (!latest) {
    return {
      tripId,
      status: latestSample ? 'GPS_UNRELIABLE' : 'NO_LIVE_DATA',
      message: latestSample
        ? 'GPS samples are being received but none are reliable enough for ETA'
        : 'Live location is not available yet',
      lastRejectionReason: latestSample?.rejectionReason || null,
      scheduledTime: selectedSchedule?.scheduledTime || null,
      etaMinutes: null,
    };
  }

  const freshness = locationFreshness(latest.receivedAt, new Date(), STALE_AFTER_MS);
  if (freshness === 'STALE_LOCATION') {
    return {
      tripId,
      status: 'STALE_LOCATION',
      message: 'The last reliable bus location is old; wait for the driver app to reconnect',
      updatedAt: latest.receivedAt,
      lastRejectionReason: latestSample?.acceptedForEta === false ? latestSample.rejectionReason : null,
      scheduledTime: selectedSchedule?.scheduledTime || null,
      etaMinutes: null,
    };
  }

  const currentIndex = Math.min(trip.currentStopIndex, stops.length);
  const eventByScheduleStop = new Map(trip.stopEvents.map((event) => [event.scheduleStopId, event]));

  if (selectedIndex != null) {
    const selected = stops[selectedIndex].stop;
    const selectedDistance = haversineDistance(
      latest.latitude,
      latest.longitude,
      selected.latitude,
      selected.longitude
    );
    if (selectedDistance <= STOP_REACHED_METERS) {
      return {
        tripId,
        stopId: selected.id,
        name: selected.name,
        status: 'AT_STOP',
        message: 'Bus is currently at or near this stop',
        distanceMeters: Math.round(selectedDistance),
        updatedAt: latest.receivedAt,
        etaMinutes: 0,
        etaRangeMinutes: { min: 0, max: 0 },
      };
    }
    if (selectedIndex < currentIndex) {
      return passedStopResult(
        tripId,
        selectedStopId,
        eventByScheduleStop.get(stops[selectedIndex].id),
        latest
      );
    }
  }

  if (currentIndex >= stops.length) {
    return {
      tripId,
      status: 'ROUTE_COMPLETED',
      message: 'Bus reached the final route stop; the driver has not ended the trip yet',
      updatedAt: latest.receivedAt,
      etaMinutes: null,
    };
  }

  const routeDistanceMeters = distanceToRouteMeters(latest.latitude, latest.longitude, stops);
  if (routeDistanceMeters != null && routeDistanceMeters > OFF_ROUTE_THRESHOLD_METERS) {
    return {
      tripId,
      stopId: selectedStopId == null ? undefined : Number(selectedStopId),
      status: 'OFF_ROUTE',
      message: 'Bus is far from the configured route; ETA is paused until it returns',
      routeDistanceMeters: Math.round(routeDistanceMeters),
      updatedAt: latest.receivedAt,
      scheduledTime: selectedSchedule?.scheduledTime || null,
      etaMinutes: null,
      etaRangeMinutes: null,
    };
  }

  const { speedKmh, confidence, moving } = await estimateSpeed(tripId);
  const stopResults = [];
  for (let index = 0; index < currentIndex; index += 1) {
    const event = eventByScheduleStop.get(stops[index].id);
    stopResults.push({
      stopId: stops[index].stop.id,
      name: stops[index].stop.name,
      scheduledTime: stops[index].scheduledTime,
      status: event?.status === 'POSSIBLY_SKIPPED' ? 'POSSIBLY_SKIPPED' : 'PASSED',
      passedAt: event?.detectedAt || null,
      etaMinutes: null,
      etaRangeMinutes: null,
    });
  }

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
    const minutes = moving === false ? null : Math.max(0, Math.round((cumulativeKm / speedKmh) * 60));
    stopResults.push({
      stopId: stops[index].stop.id,
      name: stops[index].stop.name,
      scheduledTime: stops[index].scheduledTime,
      status: index === currentIndex ? 'ARRIVING' : 'UPCOMING',
      distanceKm: Math.round(cumulativeKm * 100) / 100,
      etaMinutes: minutes,
      etaRangeMinutes: minutes == null ? null : etaRange(minutes, confidence),
    });
  }

  const gpsWarning = latestSample?.acceptedForEta === false ? latestSample.rejectionReason : null;
  if (selectedIndex != null) {
    const selected = stopResults.find((item) => item.stopId === Number(selectedStopId));
    if (moving === false) {
      return {
        tripId,
        stopId: selected.stopId,
        name: selected.name,
        status: 'NOT_MOVING',
        stopState: selected.status,
        message: 'Bus appears stationary; ETA will resume after reliable movement is detected',
        confidence,
        speedKmh: 0,
        updatedAt: latest.receivedAt,
        scheduledTime: selected.scheduledTime,
        etaMinutes: null,
        etaRangeMinutes: null,
        gpsWarning,
      };
    }
    return {
      tripId,
      status: selected.status,
      message:
        confidence === 'LOW'
          ? 'This is a rough estimate based on limited live movement'
          : 'Estimated arrival is based on recent live movement',
      confidence,
      speedKmh: Math.round(speedKmh * 10) / 10,
      updatedAt: latest.receivedAt,
      gpsWarning,
      ...selected,
    };
  }

  return {
    tripId,
    status: moving === false ? 'NOT_MOVING' : 'UPCOMING',
    message:
      moving === false
        ? 'Bus appears stationary; ETAs are paused until movement resumes'
        : 'Live route progress and estimated arrival ranges',
    currentStopIndex: currentIndex,
    confidence,
    speedKmh: Math.round(speedKmh * 10) / 10,
    updatedAt: latest.receivedAt,
    routeDistanceMeters: Math.round(routeDistanceMeters || 0),
    gpsWarning,
    stops: stopResults,
  };
}

module.exports = {
  AT_STOP_METERS: STOP_REACHED_METERS,
  DEFAULT_SPEED_KMH,
  MAX_SPEED_KMH,
  STALE_AFTER_MS,
  STATIONARY_MAX_DISTANCE_METERS,
  STATIONARY_MIN_SPAN_MS,
  estimateArrival,
  estimateSpeed,
  etaRange,
  passedStopResult,
};
