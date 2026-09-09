const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');
const { estimateArrival } = require('../lib/eta');
const { clearTripObservation } = require('../lib/lateAlert');
const { writeAdminAudit } = require('../lib/adminAudit');
const { locationFreshness } = require('../lib/liveTracking');

const router = express.Router();

async function assertDriverSession(user) {
  if (user.role !== 'driver') return null;
  const driver = await prisma.driver.findUnique({
    where: { id: Number(user.id) },
    select: { id: true, sessionVersion: true },
  });
  if (!driver || driver.sessionVersion !== user.sessionVersion) return false;
  return driver;
}

async function findRunningConflict(routeServiceId, driverId) {
  return prisma.trip.findFirst({
    where: {
      status: 'RUNNING',
      OR: [{ routeServiceId }, { driverId }],
    },
    select: { id: true, routeServiceId: true, driverId: true, startTime: true },
  });
}

function resumedTripResponse(conflict, route) {
  return {
    tripId: conflict.id,
    resumed: true,
    routeNo: route.routeNo,
    startTime: conflict.startTime,
    trackingState: 'RECOVERING',
  };
}

async function trackingSnapshot(tripId) {
  const [latestAccepted, latestSample] = await Promise.all([
    prisma.liveLocation.findFirst({
      where: { tripId, acceptedForEta: true },
      orderBy: { receivedAt: 'desc' },
      select: { latitude: true, longitude: true, receivedAt: true, accuracyMeters: true },
    }),
    prisma.liveLocation.findFirst({
      where: { tripId },
      orderBy: { receivedAt: 'desc' },
      select: { receivedAt: true, acceptedForEta: true, rejectionReason: true },
    }),
  ]);
  return {
    state: locationFreshness(latestAccepted?.receivedAt),
    lastAcceptedLocation: latestAccepted,
    lastSampleAt: latestSample?.receivedAt || null,
    lastSampleAccepted: latestSample?.acceptedForEta ?? null,
    lastRejectionReason: latestSample?.rejectionReason || null,
  };
}

router.post('/start', requireAuth(['driver', 'admin']), async (req, res) => {
  let route;
  let driverId;
  try {
    if (req.user.role === 'driver' && !(await assertDriverSession(req.user))) {
      return res.status(401).json({ error: 'Driver session has been revoked' });
    }

    driverId = req.user.role === 'driver' ? Number(req.user.id) : Number(req.body?.driverId);
    const requestedRouteId = Number(req.body?.routeServiceId);
    if (!Number.isInteger(driverId) || driverId <= 0) {
      return res.status(400).json({ error: 'A valid driverId is required' });
    }
    if (req.user.role === 'admin' && (!Number.isInteger(requestedRouteId) || requestedRouteId <= 0)) {
      return res.status(400).json({ error: 'A valid routeServiceId is required' });
    }

    route = await prisma.routeService.findFirst({
      where:
        req.user.role === 'driver'
          ? { driverId }
          : { id: requestedRouteId, driverId },
      select: { id: true, routeNo: true, driverId: true },
    });
    if (!route) return res.status(404).json({ error: 'No matching route assignment was found' });

    const existing = await findRunningConflict(route.id, driverId);
    if (existing) {
      if (existing.routeServiceId === route.id && existing.driverId === driverId) {
        return res.json(resumedTripResponse(existing, route));
      }
      return res.status(409).json({ error: 'The route or driver already has another running trip' });
    }

    const [roster, schedule] = await Promise.all([
      prisma.transportRoster.findFirst({
        where: { status: 'PUBLISHED' },
        orderBy: { publishedAt: 'desc' },
        select: { id: true },
      }),
      prisma.scheduleVersion.findFirst({
        where: { routeServiceId: route.id, status: 'PUBLISHED' },
        orderBy: { publishedAt: 'desc' },
        select: { id: true },
      }),
    ]);
    if (!roster) return res.status(409).json({ error: 'A passenger roster must be published before starting trips' });
    if (!schedule) return res.status(409).json({ error: 'A route schedule must be published before starting this trip' });

    const now = new Date();
    const trip = await prisma.$transaction(async (tx) => {
      const created = await tx.trip.create({
        data: {
          routeServiceId: route.id,
          driverId,
          rosterId: roster.id,
          scheduleVersionId: schedule.id,
          date: now,
          startTime: now,
          status: 'RUNNING',
        },
      });
      if (req.user.role === 'admin') {
        await writeAdminAudit(tx, req, {
          action: 'TRIP_STARTED_BY_ADMIN',
          entityType: 'Trip',
          entityId: created.id,
          afterSummary: {
            routeServiceId: created.routeServiceId,
            driverId: created.driverId,
            rosterId: created.rosterId,
            scheduleVersionId: created.scheduleVersionId,
            status: created.status,
          },
        });
      }
      return created;
    });
    req.app.get('io')?.to('route:' + route.id).emit('trip:started', {
      tripId: trip.id,
      routeServiceId: route.id,
      startTime: trip.startTime,
    });
    return res.status(201).json({
      tripId: trip.id,
      resumed: false,
      routeNo: route.routeNo,
      startTime: trip.startTime,
      trackingState: 'NO_LIVE_DATA',
    });
  } catch (error) {
    if ((error.code === 'P2002' || error.code === 'P2034') && route && driverId) {
      const conflict = await findRunningConflict(route.id, driverId);
      if (conflict?.routeServiceId === route.id && conflict.driverId === driverId) {
        return res.json(resumedTripResponse(conflict, route));
      }
      if (conflict) return res.status(409).json({ error: 'The route or driver already has another running trip' });
      return res.status(503).json({ error: 'Trip start conflicted with another request; retry safely' });
    }
    console.error('[trips/start]', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/end', requireAuth(['driver', 'admin']), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid trip ID' });

  const trip = await prisma.trip.findUnique({
    where: { id },
    select: { id: true, driverId: true, routeServiceId: true, status: true, endTime: true },
  });
  if (!trip) return res.status(404).json({ error: 'Trip not found' });
  if (req.user.role === 'driver') {
    if (!(await assertDriverSession(req.user))) {
      return res.status(401).json({ error: 'Driver session has been revoked' });
    }
    if (trip.driverId !== Number(req.user.id)) {
      return res.status(403).json({ error: 'This trip belongs to another driver' });
    }
  }
  if (trip.status === 'COMPLETED') {
    return res.json({ tripId: id, status: trip.status, endedAt: trip.endTime, alreadyEnded: true });
  }
  if (trip.status !== 'RUNNING') return res.status(409).json({ error: 'Only a running trip can be ended' });

  const result = await prisma.$transaction(async (tx) => {
    const changed = await tx.trip.updateMany({
      where: { id, status: 'RUNNING' },
      data: { status: 'COMPLETED', endTime: new Date() },
    });
    const completed = await tx.trip.findUnique({ where: { id } });
    if (changed.count && req.user.role === 'admin') {
      await writeAdminAudit(tx, req, {
        action: 'TRIP_ENDED_BY_ADMIN',
        entityType: 'Trip',
        entityId: id,
        beforeSummary: { routeServiceId: trip.routeServiceId, driverId: trip.driverId, status: trip.status },
        afterSummary: {
          routeServiceId: completed.routeServiceId,
          driverId: completed.driverId,
          status: completed.status,
          endedAt: completed.endTime,
        },
      });
    }
    return { completed, changed: Boolean(changed.count) };
  });

  if (result.changed) {
    clearTripObservation(id);
    req.app.get('io')?.to(['trip:' + id, 'route:' + trip.routeServiceId]).emit('trip:ended', {
      tripId: id,
      endedAt: result.completed.endTime,
    });
  }
  return res.json({
    tripId: id,
    status: result.completed.status,
    endedAt: result.completed.endTime,
    alreadyEnded: !result.changed,
  });
});

router.get('/mine', requireAuth(['driver']), async (req, res) => {
  if (!(await assertDriverSession(req.user))) {
    return res.status(401).json({ error: 'Driver session has been revoked' });
  }
  const trip = await prisma.trip.findFirst({
    where: { driverId: Number(req.user.id), status: 'RUNNING' },
    include: {
      routeService: { select: { id: true, routeNo: true, name: true, areaCovered: true, capacity: true } },
      scheduleVersion: {
        include: { stops: { orderBy: { sequenceOrder: 'asc' }, include: { stop: true } } },
      },
    },
  });
  return res.json({ trip, tracking: trip ? await trackingSnapshot(trip.id) : null });
});

router.get('/active', async (_req, res) => {
  const trips = await prisma.trip.findMany({
    where: { status: 'RUNNING' },
    select: {
      id: true,
      startTime: true,
      currentStopIndex: true,
      routeService: {
        select: {
          id: true,
          routeNo: true,
          name: true,
          areaCovered: true,
          capacity: true,
          driver: { select: { name: true } },
        },
      },
    },
    orderBy: { startTime: 'asc' },
  });
  const result = await Promise.all(
    trips.map(async (trip) => ({
      tripId: trip.id,
      startTime: trip.startTime,
      currentStopIndex: trip.currentStopIndex,
      route: trip.routeService,
      tracking: await trackingSnapshot(trip.id),
    }))
  );
  return res.json(result);
});

router.get('/:id/eta', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid trip ID' });
  const result = await estimateArrival(id);
  if (!result) return res.status(404).json({ error: 'Trip not found' });
  return res.json(result);
});

module.exports = router;
module.exports.assertDriverSession = assertDriverSession;
module.exports.findRunningConflict = findRunningConflict;
module.exports.trackingSnapshot = trackingSnapshot;
