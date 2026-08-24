const prisma = require('./lib/prisma');
const haversineDistance = require('./lib/haversine');
const { verifyToken } = require('./middleware/auth');
const { locationPayloadSchema } = require('./schemas');
const { estimateArrival } = require('./lib/eta');
const { observeTripEta } = require('./lib/lateAlert');

const STOP_REACHED_METERS = 150;
const MAX_ACCEPTED_SPEED_KMH = 120;

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
    socket.on('join:trip', async ({ tripId } = {}) => {
      const id = Number(tripId);
      if (!Number.isInteger(id) || id <= 0) return;
      const exists = await prisma.trip.findUnique({ where: { id }, select: { id: true, routeServiceId: true } });
      if (!exists) return;
      socket.join(`trip:${id}`);
      socket.join(`route:${exists.routeServiceId}`);
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

      const { tripId, latitude, longitude, deviceTimestamp } = parsed.data;
      try {
        const trip = await prisma.trip.findUnique({
          where: { id: tripId },
          include: {
            driver: { select: { sessionVersion: true } },
            scheduleVersion: {
              include: { stops: { orderBy: { sequenceOrder: 'asc' }, include: { stop: true } } },
            },
          },
        });
        if (!trip || trip.status !== 'RUNNING') {
          acknowledge?.({ ok: false, error: 'Trip is not running' });
          return;
        }
        if (
          trip.driverId !== Number(socket.user.id) ||
          trip.driver.sessionVersion !== socket.user.sessionVersion
        ) {
          acknowledge?.({ ok: false, error: 'This trip belongs to another driver or the session was revoked' });
          return;
        }

        const latest = await prisma.liveLocation.findFirst({
          where: { tripId, acceptedForEta: true },
          orderBy: { receivedAt: 'desc' },
        });
        let acceptedForEta = true;
        let rejectionReason = null;
        if (latest) {
          const distanceMeters = haversineDistance(
            latest.latitude,
            latest.longitude,
            latitude,
            longitude
          );
          const elapsedMs = Math.max(1, Date.now() - new Date(latest.receivedAt).getTime());
          const speedKmh = distanceMeters / 1000 / (elapsedMs / 3600000);
          if (speedKmh > MAX_ACCEPTED_SPEED_KMH) {
            acceptedForEta = false;
            rejectionReason = 'IMPOSSIBLE_SPEED';
          }
        }

        const result = await prisma.$transaction(async (tx) => {
          const location = await tx.liveLocation.create({
            data: {
              tripId,
              latitude,
              longitude,
              deviceTimestamp: deviceTimestamp || null,
              acceptedForEta,
              rejectionReason,
            },
          });
          let currentStopIndex = trip.currentStopIndex;
          if (acceptedForEta) {
            const next = trip.scheduleVersion.stops[currentStopIndex];
            if (next) {
              const distance = haversineDistance(
                latitude,
                longitude,
                next.stop.latitude,
                next.stop.longitude
              );
              if (distance <= STOP_REACHED_METERS) {
                const advanced = await tx.trip.updateMany({
                  where: { id: tripId, currentStopIndex },
                  data: { currentStopIndex: { increment: 1 } },
                });
                if (advanced.count) {
                  currentStopIndex += 1;
                  await tx.tripStopEvent.upsert({
                    where: { tripId_scheduleStopId: { tripId, scheduleStopId: next.id } },
                    update: {
                      status: 'REACHED',
                      detectedAt: location.receivedAt,
                      latitude,
                      longitude,
                    },
                    create: {
                      tripId,
                      scheduleStopId: next.id,
                      status: 'REACHED',
                      detectedAt: location.receivedAt,
                      latitude,
                      longitude,
                    },
                  });
                }
              }
            }
          }
          return { location, currentStopIndex };
        });

        if (!acceptedForEta) {
          acknowledge?.({ ok: false, error: 'Location was stored but rejected from live ETA', reason: rejectionReason });
          return;
        }

        const eta = await estimateArrival(tripId);
        const update = {
          tripId,
          routeServiceId: trip.routeServiceId,
          latitude,
          longitude,
          currentStopIndex: result.currentStopIndex,
          timestamp: result.location.receivedAt,
          eta,
        };
        io.to(`trip:${tripId}`).emit('bus:update', update);
        io.to(`route:${trip.routeServiceId}`).emit('bus:update', update);
        observeTripEta(tripId, eta).catch((error) => {
          console.error('[late-alert/observe]', error);
        });
        acknowledge?.({ ok: true, timestamp: result.location.receivedAt });
      } catch (error) {
        console.error('[socket/driver:location]', error);
        acknowledge?.({ ok: false, error: 'Location update failed' });
      }
    });
  });
}

module.exports = setupSocket;
module.exports.STOP_REACHED_METERS = STOP_REACHED_METERS;
module.exports.MAX_ACCEPTED_SPEED_KMH = MAX_ACCEPTED_SPEED_KMH;
