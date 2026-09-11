const prisma = require('./lib/prisma');
const { verifyToken } = require('./middleware/auth');
const { locationPayloadSchema } = require('./schemas');
const { observeTripEta } = require('./lib/lateAlert');
const { isEtaRefreshDue, refreshTripEta } = require('./lib/etaRefresh');
const { enqueueStopArrivalAlerts } = require('./lib/stopAlerts');
const { consumeSocketRate } = require('./middleware/security');
const {
  MAX_ACCEPTED_SPEED_KMH,
  STOP_REACHED_METERS,
  assessLocationSample,
  classifyRouteProgress,
} = require('./lib/liveTracking');
const { operationalStops } = require('./lib/tripSchedule');

function setupSocket(io) {
  // Passenger sockets may connect without a token. A valid driver token is
  // mandatory before the socket can emit driver:location.
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next();
    try {
      socket.user = verifyToken(token);
      return next();
    } catch (_error) {
      return next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (socket) => {
    if (socket.user?.role === 'driver') socket.join(`driver:${socket.user.id}`);
    if (socket.user?.role === 'admin') socket.join('admin');
    socket.on('join:trip', async ({ tripId } = {}, acknowledge) => {
      const id = Number(tripId);
      if (!Number.isInteger(id) || id <= 0) {
        acknowledge?.({ ok: false, error: 'Invalid trip ID' });
        return;
      }
      const exists = await prisma.trip.findUnique({
        where: { id },
        select: { id: true, routeServiceId: true, status: true },
      });
      if (!exists) {
        acknowledge?.({ ok: false, error: 'Trip not found' });
        return;
      }
      socket.join('trip:' + id);
      socket.join('route:' + exists.routeServiceId);
      acknowledge?.({ ok: true, status: exists.status });
    });

    socket.on('driver:location', async (payload, acknowledge) => {
      const parsed = locationPayloadSchema.safeParse(payload);
      if (!parsed.success) {
        acknowledge?.({ ok: false, error: 'Invalid location payload' });
        return;
      }
      if (socket.user?.role !== 'driver') {
        acknowledge?.({ ok: false, error: 'Driver authentication is required' });
        return;
      }
      const rate = consumeSocketRate(socket, 'driver:location');
      if (!rate.allowed) {
        acknowledge?.({
          ok: false,
          error: 'Location update rate limit exceeded',
          reason: 'RATE_LIMITED',
          retryAfterMs: rate.retryAfterMs,
        });
        return;
      }

      const {
        tripId,
        latitude,
        longitude,
        deviceTimestamp,
        accuracyMeters,
        deviceSpeedKmh,
      } = parsed.data;
      try {
        const trip = await prisma.trip.findUnique({
          where: { id: tripId },
          include: {
            driver: { select: { sessionVersion: true, status: true } },
            scheduleVersion: {
              include: { stops: { orderBy: { sequenceOrder: 'asc' }, include: { stop: true } } },
            },
          },
        });
        if (!trip || trip.status !== 'RUNNING') {
          acknowledge?.({ ok: false, error: 'Trip is not running', reason: 'TRIP_NOT_RUNNING' });
          return;
        }
        if (
          trip.driverId !== Number(socket.user.id) ||
          trip.driver.status !== 'ACTIVE' ||
          trip.driver.sessionVersion !== socket.user.sessionVersion
        ) {
          acknowledge?.({ ok: false, error: 'This trip belongs to another driver or the session was revoked' });
          return;
        }

        const [latestAccepted, latestDeviceSample] = await Promise.all([
          prisma.liveLocation.findFirst({
            where: { tripId, acceptedForEta: true },
            orderBy: { receivedAt: 'desc' },
          }),
          deviceTimestamp
            ? prisma.liveLocation.findFirst({
                where: { tripId, acceptedForEta: true, deviceTimestamp: { not: null } },
                orderBy: { deviceTimestamp: 'desc' },
                select: { deviceTimestamp: true },
              })
            : null,
        ]);
        const assessment = assessLocationSample({
          sample: { latitude, longitude, deviceTimestamp, accuracyMeters, deviceSpeedKmh },
          latestAccepted,
          latestDeviceTimestamp: latestDeviceSample?.deviceTimestamp,
        });

        const result = await prisma.$transaction(async (tx) => {
          await tx.$queryRawUnsafe('SELECT "id" FROM "Trip" WHERE "id" = $1 FOR UPDATE', tripId);
          const lockedTrip = await tx.trip.findUnique({
            where: { id: tripId },
            select: { id: true, driverId: true, status: true, currentStopIndex: true },
          });
          if (!lockedTrip || lockedTrip.status !== 'RUNNING') {
            throw Object.assign(new Error('Trip is not running'), { code: 'TRIP_NOT_RUNNING' });
          }
          if (lockedTrip.driverId !== Number(socket.user.id)) {
            throw Object.assign(new Error('Trip ownership changed'), { code: 'TRIP_OWNERSHIP_CHANGED' });
          }

          const location = await tx.liveLocation.create({
            data: {
              tripId,
              latitude,
              longitude,
              deviceTimestamp: deviceTimestamp || null,
              accuracyMeters: accuracyMeters ?? null,
              deviceSpeedKmh: deviceSpeedKmh ?? null,
              acceptedForEta: assessment.accepted,
              rejectionReason: assessment.reason,
            },
          });
          if (!assessment.accepted) {
            return {
              location,
              currentStopIndex: lockedTrip.currentStopIndex,
              progress: { state: 'GPS_REJECTED', events: [], routeDistanceMeters: null },
            };
          }

          const tripStops = operationalStops(trip);
          const progress = classifyRouteProgress({
            latitude,
            longitude,
            stops: tripStops,
            currentStopIndex: lockedTrip.currentStopIndex,
          });
          for (const event of progress.events) {
            const scheduleStop = tripStops[event.index];
            await tx.tripStopEvent.upsert({
              where: { tripId_scheduleStopId: { tripId, scheduleStopId: scheduleStop.id } },
              update: {
                status: event.status,
                detectedAt: location.receivedAt,
                latitude,
                longitude,
              },
              create: {
                tripId,
                scheduleStopId: scheduleStop.id,
                status: event.status,
                detectedAt: location.receivedAt,
                latitude,
                longitude,
              },
            });
          }
          if (progress.nextStopIndex > lockedTrip.currentStopIndex) {
            await tx.trip.update({
              where: { id: tripId },
              data: { currentStopIndex: progress.nextStopIndex },
            });
          }
          return { location, currentStopIndex: progress.nextStopIndex, progress };
        });

        if (!assessment.accepted) {
          acknowledge?.({
            ok: false,
            stored: true,
            error: 'Location was stored but rejected from live ETA',
            reason: assessment.reason,
          });
          return;
        }

        const update = {
          tripId,
          routeServiceId: trip.routeServiceId,
          latitude,
          longitude,
          currentStopIndex: result.currentStopIndex,
          progressState: result.progress.state,
          routeDistanceMeters:
            result.progress.routeDistanceMeters == null
              ? null
              : Math.round(result.progress.routeDistanceMeters),
          timestamp: result.location.receivedAt,
          eta: trip.currentEta || null,
          etaCalculatedAt: trip.currentEtaAt || null,
        };
        // Socket.IO treats an array of rooms as a union, so clients that joined
        // both rooms receive one update rather than duplicate events.
        io.to(['trip:' + tripId, 'route:' + trip.routeServiceId]).emit('bus:update', update);
        acknowledge?.({
          ok: true,
          timestamp: result.location.receivedAt,
          currentStopIndex: result.currentStopIndex,
          progressState: result.progress.state,
        });
        const meaningfulTransition = result.progress.events.length > 0;
        if (isEtaRefreshDue(trip.currentEtaAt, meaningfulTransition)) {
          refreshTripEta(tripId)
            .then((refreshed) => {
              if (!refreshed) return;
              io.to(['trip:' + tripId, 'route:' + trip.routeServiceId]).emit('bus:eta', {
                tripId,
                routeServiceId: trip.routeServiceId,
                eta: refreshed.eta,
                etaCalculatedAt: refreshed.calculatedAt,
              });
              enqueueStopArrivalAlerts(tripId, refreshed.eta)
                .catch(() => console.error('[stop-alerts/enqueue] failed'));
              return observeTripEta(tripId, refreshed.eta);
            })
            .catch((error) => console.error('[eta/refresh]', error));
        }
      } catch (error) {
        if (error.code === 'P2002' && deviceTimestamp) {
          const existing = await prisma.liveLocation.findFirst({ where: { tripId, deviceTimestamp } });
          acknowledge?.({
            ok: Boolean(existing?.acceptedForEta),
            duplicate: true,
            timestamp: existing?.receivedAt || null,
            reason: existing?.rejectionReason || null,
          });
          return;
        }
        if (error.code === 'TRIP_NOT_RUNNING') {
          acknowledge?.({ ok: false, error: 'Trip is not running', reason: error.code });
          return;
        }
        if (error.code === 'TRIP_OWNERSHIP_CHANGED') {
          acknowledge?.({ ok: false, error: 'This trip belongs to another driver', reason: error.code });
          return;
        }
        console.error('[socket/driver:location]', error);
        acknowledge?.({ ok: false, error: 'Location update failed' });
      }
    });
  });
}

module.exports = setupSocket;
module.exports.STOP_REACHED_METERS = STOP_REACHED_METERS;
module.exports.MAX_ACCEPTED_SPEED_KMH = MAX_ACCEPTED_SPEED_KMH;
