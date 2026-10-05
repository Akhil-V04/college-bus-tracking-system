const prisma = require('./prisma');

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function medianAbsoluteDeviation(values, center = median(values)) {
  if (!values.length || center == null) return null;
  return median(values.map((value) => Math.abs(value - center)));
}

function classifyDuration(durationSeconds, normalDurations) {
  if (normalDurations.length < 3) return { classification: 'NORMAL', deviationScore: null };
  const center = median(normalDurations);
  const mad = medianAbsoluteDeviation(normalDurations, center);
  const scale = Math.max(mad || 0, 60);
  const deviationScore = Math.abs(durationSeconds - center) / scale;
  const disruption = durationSeconds > center + Math.max(3 * scale, center);
  return {
    classification: disruption ? 'DISRUPTION' : 'NORMAL',
    deviationScore: Math.round(deviationScore * 100) / 100,
  };
}

function timeWindowFor(date) {
  const hour = Number(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata', hour: '2-digit', hourCycle: 'h23',
  }).format(new Date(date)));
  if (hour < 6) return 'v1:NIGHT';
  if (hour < 10) return 'v1:MORNING';
  if (hour < 16) return 'v1:MIDDAY';
  if (hour < 20) return 'v1:EVENING';
  return 'v1:NIGHT';
}

function confidenceFor(sampleCount) {
  if (sampleCount >= 10) return 'HIGH';
  if (sampleCount >= 3) return 'MEDIUM';
  return 'LOW';
}

async function aggregateTripSegments(tripId) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRawUnsafe('SELECT "id" FROM "Trip" WHERE "id" = $1 FOR UPDATE', tripId);
    const trip = await tx.trip.findUnique({
      where: { id: tripId },
      include: {
        scheduleVersion: { include: { stops: { orderBy: { sequenceOrder: 'asc' } } } },
        stopEvents: true,
      },
    });
    if (!trip || trip.status !== 'COMPLETED') return { processed: false, segments: 0 };
    if (trip.segmentAggregatedAt) return { processed: false, segments: 0, alreadyProcessed: true };

    const eventByStop = new Map(trip.stopEvents.map((event) => [event.scheduleStopId, event]));
    let segments = 0;
    for (let index = 1; index < trip.scheduleVersion.stops.length; index += 1) {
      const fromStop = trip.scheduleVersion.stops[index - 1];
      const toStop = trip.scheduleVersion.stops[index];
      const fromEvent = eventByStop.get(fromStop.id);
      const toEvent = eventByStop.get(toStop.id);
      if (fromEvent?.status !== 'REACHED' || toEvent?.status !== 'REACHED') continue;
      const durationSeconds = Math.round((toEvent.detectedAt - fromEvent.detectedAt) / 1000);
      if (durationSeconds < 30 || durationSeconds > 10800) continue;
      const weekdayName = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Kolkata', weekday: 'short',
      }).format(fromEvent.detectedAt);
      const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekdayName);
      const timeWindow = timeWindowFor(fromEvent.detectedAt);
      const key = {
        routeServiceId: trip.routeServiceId,
        scheduleVersionId: trip.scheduleVersionId,
        fromScheduleStopId: fromStop.id,
        toScheduleStopId: toStop.id,
        weekday,
        timeWindow,
      };
      const baseline = await tx.segmentTravelSample.findMany({
        where: { ...key, classification: 'NORMAL' },
        select: { durationSeconds: true },
        orderBy: { endedAt: 'desc' },
        take: 50,
      });
      const classification = classifyDuration(durationSeconds, baseline.map((row) => row.durationSeconds));
      await tx.segmentTravelSample.upsert({
        where: { tripId_fromScheduleStopId_toScheduleStopId: { tripId, fromScheduleStopId: fromStop.id, toScheduleStopId: toStop.id } },
        update: {},
        create: {
          tripId,
          ...key,
          startedAt: fromEvent.detectedAt,
          endedAt: toEvent.detectedAt,
          durationSeconds,
          ...classification,
        },
      });
      const normalSamples = await tx.segmentTravelSample.findMany({
        where: { ...key, classification: 'NORMAL' },
        select: { durationSeconds: true },
      });
      const durations = normalSamples.map((row) => row.durationSeconds);
      const center = median(durations);
      await tx.segmentTravelAggregate.upsert({
        where: { routeServiceId_scheduleVersionId_fromScheduleStopId_toScheduleStopId_weekday_timeWindow: key },
        update: {
          sampleCount: durations.length,
          medianSeconds: center,
          averageSeconds: durations.reduce((sum, value) => sum + value, 0) / durations.length,
          madSeconds: medianAbsoluteDeviation(durations, center),
          confidence: confidenceFor(durations.length),
        },
        create: {
          ...key,
          sampleCount: durations.length,
          medianSeconds: center,
          averageSeconds: durations.reduce((sum, value) => sum + value, 0) / durations.length,
          madSeconds: medianAbsoluteDeviation(durations, center),
          confidence: confidenceFor(durations.length),
        },
      });
      segments += 1;
    }
    await tx.trip.update({ where: { id: tripId }, data: { segmentAggregatedAt: new Date() } });
    return { processed: true, segments };
  }, { isolationLevel: 'Serializable' });
}

module.exports = {
  aggregateTripSegments,
  classifyDuration,
  confidenceFor,
  median,
  medianAbsoluteDeviation,
  timeWindowFor,
};
