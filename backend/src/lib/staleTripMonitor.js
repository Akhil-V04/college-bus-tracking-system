const prisma = require('./prisma');
const { STALE_AFTER_MS } = require('./eta');
const { locationFreshness } = require('./liveTracking');

const DEFAULT_INTERVAL_MS = 30 * 1000;

function monitorState({ startTime, latestLocationAt }, now = new Date()) {
  if (latestLocationAt) return locationFreshness(latestLocationAt, now, STALE_AFTER_MS);
  return now.getTime() - new Date(startTime).getTime() > STALE_AFTER_MS ? 'NO_LIVE_DATA' : 'WAITING_FOR_GPS';
}

function setupStaleTripMonitor(io, options = {}) {
  const intervalMs = options.intervalMs || DEFAULT_INTERVAL_MS;
  const staleTripIds = new Set();

  async function check() {
    const trips = await prisma.trip.findMany({
      where: { status: 'RUNNING' },
      select: {
        id: true,
        routeServiceId: true,
        startTime: true,
        liveLocations: {
          where: { acceptedForEta: true },
          orderBy: { receivedAt: 'desc' },
          take: 1,
          select: { receivedAt: true },
        },
      },
    });
    const runningIds = new Set(trips.map((trip) => trip.id));
    for (const staleId of staleTripIds) {
      if (!runningIds.has(staleId)) staleTripIds.delete(staleId);
    }

    const now = new Date();
    for (const trip of trips) {
      const state = monitorState(
        { startTime: trip.startTime, latestLocationAt: trip.liveLocations[0]?.receivedAt || null },
        now
      );
      const rooms = ['trip:' + trip.id, 'route:' + trip.routeServiceId];
      if (state === 'STALE_LOCATION' || state === 'NO_LIVE_DATA') {
        if (!staleTripIds.has(trip.id)) {
          staleTripIds.add(trip.id);
          io.to(rooms).emit('trip:stale', { tripId: trip.id, state, detectedAt: now });
        }
      } else if (state === 'LIVE' && staleTripIds.delete(trip.id)) {
        io.to(rooms).emit('trip:recovered', { tripId: trip.id, state: 'LIVE', recoveredAt: now });
      }
    }
  }

  const timer = setInterval(() => {
    check().catch((error) => console.error('[trip/stale-monitor]', error));
  }, intervalMs);
  timer.unref?.();
  check().catch((error) => console.error('[trip/stale-monitor]', error));
  return { check, stop: () => clearInterval(timer), staleTripIds };
}

module.exports = { DEFAULT_INTERVAL_MS, monitorState, setupStaleTripMonitor };
