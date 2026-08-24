const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');
const { estimateArrival } = require('../lib/eta');
const { clearTripObservation } = require('../lib/lateAlert');

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

router.post('/start', requireAuth(['driver', 'admin']), async (req, res) => {
  try {
    if (req.user.role === 'driver' && !(await assertDriverSession(req.user))) {
      return res.status(401).json({ error: 'Driver session has been revoked' });
    }

    const driverId = req.user.role === 'driver' ? Number(req.user.id) : Number(req.body?.driverId);
    const route = await prisma.routeService.findFirst({
      where:
        req.user.role === 'driver'
          ? { driverId }
          : { id: Number(req.body?.routeServiceId), driverId },
      select: { id: true, routeNo: true, driverId: true },
    });
    if (!route) return res.status(404).json({ error: 'No matching route assignment was found' });

    const existing = await prisma.trip.findFirst({
      where: { routeServiceId: route.id, status: 'RUNNING' },
      select: { id: true, driverId: true, startTime: true },
    });
    if (existing) {
      if (existing.driverId !== driverId) {
        return res.status(409).json({ error: 'This route already has a running trip controlled by another driver' });
      }
      return res.json({ tripId: existing.id, resumed: true, startTime: existing.startTime });
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
    const trip = await prisma.trip.create({
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
    req.app.get('io')?.to(`route:${route.id}`).emit('trip:started', {
      tripId: trip.id,
      routeServiceId: route.id,
      startTime: trip.startTime,
    });
    return res.status(201).json({ tripId: trip.id, resumed: false, routeNo: route.routeNo });
  } catch (error) {
    console.error('[trips/start]', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/end', requireAuth(['driver', 'admin']), async (req, res) => {
  const id = Number(req.params.id);
  const trip = await prisma.trip.findUnique({
    where: { id },
    select: { id: true, driverId: true, routeServiceId: true, status: true },
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
  if (trip.status !== 'RUNNING') return res.status(409).json({ error: 'Trip is not running' });

  const updated = await prisma.trip.update({
    where: { id },
    data: { status: 'COMPLETED', endTime: new Date() },
  });
  clearTripObservation(id);
  req.app.get('io')?.to(`trip:${id}`).emit('trip:ended', {
    tripId: id,
    endedAt: updated.endTime,
  });
  return res.json({ tripId: id, status: updated.status, endedAt: updated.endTime });
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
  return res.json({ trip });
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
      latestLocation: await prisma.liveLocation.findFirst({
        where: { tripId: trip.id, acceptedForEta: true },
        orderBy: { receivedAt: 'desc' },
        select: { latitude: true, longitude: true, receivedAt: true },
      }),
    }))
  );
  return res.json(result);
});

router.get('/:id/eta', async (req, res) => {
  const result = await estimateArrival(Number(req.params.id));
  if (!result) return res.status(404).json({ error: 'Trip not found' });
  return res.json(result);
});

module.exports = router;
module.exports.assertDriverSession = assertDriverSession;
