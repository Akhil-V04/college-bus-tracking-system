const express = require('express');
const prisma = require('../lib/prisma');
const { estimateArrival } = require('../lib/eta');
const { locationFreshness } = require('../lib/liveTracking');

const router = express.Router();

async function getPublishedRoster() {
  return prisma.transportRoster.findFirst({
    where: { status: 'PUBLISHED' },
    orderBy: { publishedAt: 'desc' },
    select: { id: true, name: true, academicYear: true, version: true },
  });
}

router.get('/routes', async (_req, res) => {
  try {
    const roster = await getPublishedRoster();
    const routes = await prisma.routeService.findMany({
      select: {
        id: true,
        routeNo: true,
        name: true,
        areaCovered: true,
        capacity: true,
        driver: { select: { name: true } },
      },
      orderBy: { routeNo: 'asc' },
    });
    const counts = roster
      ? await prisma.rosterPassenger.groupBy({
          by: ['routeServiceId'],
          where: { rosterId: roster.id },
          _count: { _all: true },
        })
      : [];
    const countByRoute = new Map(counts.map((item) => [item.routeServiceId, item._count._all]));
    return res.json(
      routes.map((route) => ({
        ...route,
        assignedPassengerCount: countByRoute.get(route.id) || 0,
        roster: roster ? { name: roster.name, academicYear: roster.academicYear } : null,
      }))
    );
  } catch (error) {
    console.error('[passenger/routes]', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/routes/:routeNo', async (req, res) => {
  try {
    const route = await prisma.routeService.findUnique({
      where: { routeNo: req.params.routeNo },
      select: {
        id: true,
        routeNo: true,
        name: true,
        areaCovered: true,
        capacity: true,
        driver: { select: { name: true } },
        schedules: {
          where: { status: 'PUBLISHED' },
          orderBy: { publishedAt: 'desc' },
          take: 1,
          select: {
            id: true,
            name: true,
            direction: true,
            stops: {
              orderBy: { sequenceOrder: 'asc' },
              select: {
                id: true,
                sequenceOrder: true,
                scheduledTime: true,
                stop: { select: { id: true, name: true, latitude: true, longitude: true } },
              },
            },
          },
        },
      },
    });
    if (!route) return res.status(404).json({ error: 'Route not found' });

    const roster = await getPublishedRoster();
    const assignedPassengerCount = roster
      ? await prisma.rosterPassenger.count({ where: { rosterId: roster.id, routeServiceId: route.id } })
      : 0;
    const runningTrip = await prisma.trip.findFirst({
      where: { routeServiceId: route.id, status: 'RUNNING' },
      orderBy: { startTime: 'desc' },
      select: { id: true, startTime: true, currentStopIndex: true },
    });
    let activeTrip = null;
    if (runningTrip) {
      const latestLocation = await prisma.liveLocation.findFirst({
        where: { tripId: runningTrip.id, acceptedForEta: true },
        orderBy: { receivedAt: 'desc' },
        select: { receivedAt: true },
      });
      activeTrip = {
        ...runningTrip,
        trackingState: locationFreshness(latestLocation?.receivedAt),
        lastLocationAt: latestLocation?.receivedAt || null,
      };
    }
    return res.json({
      ...route,
      schedule: route.schedules[0] || null,
      schedules: undefined,
      assignedPassengerCount,
      activeTrip,
      roster: roster ? { name: roster.name, academicYear: roster.academicYear } : null,
    });
  } catch (error) {
    console.error('[passenger/route]', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/routes/:routeNo/roster', async (req, res) => {
  try {
    const [route, roster] = await Promise.all([
      prisma.routeService.findUnique({ where: { routeNo: req.params.routeNo }, select: { id: true, routeNo: true } }),
      getPublishedRoster(),
    ]);
    if (!route) return res.status(404).json({ error: 'Route not found' });
    if (!roster) return res.status(404).json({ error: 'No published passenger roster' });

    const passengers = await prisma.rosterPassenger.findMany({
      where: { rosterId: roster.id, routeServiceId: route.id },
      select: {
        name: true,
        passengerType: true,
        boardingStopId: true,
        boardingStop: { select: { id: true, name: true } },
      },
      orderBy: [{ boardingStopId: 'asc' }, { name: 'asc' }],
    });
    const schedule = await prisma.scheduleVersion.findFirst({
      where: { routeServiceId: route.id, status: 'PUBLISHED' },
      orderBy: { publishedAt: 'desc' },
      select: {
        stops: {
          orderBy: { sequenceOrder: 'asc' },
          select: { stopId: true, sequenceOrder: true, scheduledTime: true, stop: { select: { name: true } } },
        },
      },
    });

    const passengersByStop = new Map();
    for (const passenger of passengers) {
      if (!passengersByStop.has(passenger.boardingStopId)) passengersByStop.set(passenger.boardingStopId, []);
      passengersByStop.get(passenger.boardingStopId).push({
        name: passenger.name,
        passengerType: passenger.passengerType,
      });
    }
    const stops = (schedule?.stops || []).map((entry) => ({
      stopId: entry.stopId,
      stopName: entry.stop.name,
      sequenceOrder: entry.sequenceOrder,
      scheduledTime: entry.scheduledTime,
      passengers: passengersByStop.get(entry.stopId) || [],
    }));
    return res.json({ routeNo: route.routeNo, roster, total: passengers.length, stops });
  } catch (error) {
    console.error('[passenger/roster]', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/trips/:tripId/eta/:stopId', async (req, res) => {
  const tripId = Number(req.params.tripId);
  const stopId = Number(req.params.stopId);
  if (!Number.isInteger(tripId) || tripId <= 0 || !Number.isInteger(stopId) || stopId <= 0) {
    return res.status(400).json({ error: 'Invalid trip or stop ID' });
  }
  const result = await estimateArrival(tripId, stopId);
  if (!result) return res.status(404).json({ error: 'Trip not found' });
  if (result.status === 'INVALID_STOP') return res.status(400).json(result);
  return res.json(result);
});

module.exports = router;
module.exports.getPublishedRoster = getPublishedRoster;
