const prisma = require('./lib/prisma');
const haversineDistance = require('./lib/haversine');

// Distance (meters) under which a bus is considered "at" the next stop.
const STOP_REACHED_METERS = 150;

// Attaches all real-time tracking behavior to the Socket.io server.
function setupSocket(io) {
  io.on('connection', (socket) => {
    console.log(`[socket] client connected: ${socket.id}`);

    // Join a trip's broadcast room so this client receives bus:update /
    // occupancy:update events for that trip.
    socket.on('join:trip', ({ tripId }) => {
      if (!tripId) return;
      socket.join(`trip:${tripId}`);
      console.log(`[socket] ${socket.id} joined trip:${tripId}`);
    });

    // Driver streams a GPS fix for a running trip.
    socket.on('driver:location', async ({ tripId, latitude, longitude }) => {
      if (!tripId || typeof latitude !== 'number' || typeof longitude !== 'number') return;
      try {
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
        if (!trip || trip.status !== 'RUNNING') return;

        // 1. Load the current stop index from the latest LiveLocation (defaults 0).
        const latest = await prisma.liveLocation.findFirst({
          where: { tripId },
          orderBy: { timestamp: 'desc' },
        });
        let currentStopIndex = latest ? latest.currentStopIndex : 0;

        const routeStops = trip.bus.route.routeStops;

        // 2. Stop detection: if the next unreached stop is within STOP_REACHED_METERS,
        //    mark it reached by incrementing currentStopIndex.
        if (routeStops.length > 0) {
          const nextStop = routeStops[currentStopIndex];
          if (nextStop) {
            const d = haversineDistance(
              latitude,
              longitude,
              nextStop.stop.latitude,
              nextStop.stop.longitude
            );
            if (d < STOP_REACHED_METERS) {
              currentStopIndex = Math.min(currentStopIndex + 1, routeStops.length);
            }
          }
        }

        // 3. Persist the fix with the (possibly advanced) stop index.
        await prisma.liveLocation.create({
          data: { tripId, latitude, longitude, currentStopIndex },
        });

        // 4. Broadcast to everyone watching this trip.
        io.to(`trip:${tripId}`).emit('bus:update', {
          tripId,
          latitude,
          longitude,
          currentStopIndex,
          timestamp: Date.now(),
        });
      } catch (err) {
        console.error('[socket] driver:location error', err);
      }
    });

    socket.on('disconnect', () => {
      console.log(`[socket] client disconnected: ${socket.id}`);
    });
  });
}

module.exports = setupSocket;
module.exports.STOP_REACHED_METERS = STOP_REACHED_METERS;