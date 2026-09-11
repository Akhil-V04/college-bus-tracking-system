const express = require('express');
const prisma = require('../lib/prisma');
const { estimateArrival } = require('../lib/eta');
const { locationFreshness } = require('../lib/liveTracking');
const haversineDistance = require('../lib/haversine');

const router = express.Router();

async function getPublishedRoster() {
  return prisma.transportRoster.findFirst({
    where: { status: 'PUBLISHED' },
    orderBy: { publishedAt: 'desc' },
    select: { id: true, name: true, academicYear: true, version: true },
  });
}

function parseNearbyQuery(query) {
  const latitude = Number(query.latitude);
  const longitude = Number(query.longitude);
  const radiusMeters = query.radiusMeters == null ? 10000 : Number(query.radiusMeters);
  const limit = query.limit == null ? 10 : Number(query.limit);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) return null;
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) return null;
  if (!Number.isFinite(radiusMeters) || radiusMeters < 100 || radiusMeters > 50000) return null;
  if (!Number.isInteger(limit) || limit < 1 || limit > 20) return null;
  return { latitude, longitude, radiusMeters, limit };
}

function rankNearestStops(stops, query) {
  return stops
    .map((stop) => ({
      ...stop,
      distanceMeters: Math.round(haversineDistance(query.latitude, query.longitude, stop.latitude, stop.longitude)),
    }))
    .filter((stop) => stop.distanceMeters <= query.radiusMeters)
    .sort((left, right) => left.distanceMeters - right.distanceMeters || left.id - right.id)
    .slice(0, query.limit);
}

router.get('/routes', async (req, res) => {
  try {
    const roster = await getPublishedRoster();
    const search = String(req.query.q || '').trim().slice(0, 100);
    const routes = await prisma.routeService.findMany({
      where: search
        ? {
            OR: [
              { routeNo: { contains: search, mode: 'insensitive' } },
              { name: { contains: search, mode: 'insensitive' } },
              { areaCovered: { contains: search, mode: 'insensitive' } },
              { schedules: { some: { status: 'PUBLISHED', stops: { some: { stop: { name: { contains: search, mode: 'insensitive' } } } } } } },
            ],
          }
        : undefined,
      select: {
        id: true,
        routeNo: true,
        name: true,
        areaCovered: true,
        capacity: true,
        driver: { select: { name: true, status: true } },
        trips: { where: { status: 'RUNNING' }, select: { id: true }, take: 1 },
        schedules: {
          where: { status: 'PUBLISHED' },
          orderBy: { publishedAt: 'desc' },
          take: 1,
          select: {
            stops: {
              orderBy: { sequenceOrder: 'asc' },
              take: 5,
              select: { stop: { select: { id: true, name: true } } },
            },
          },
        },
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
        id: route.id,
        routeNo: route.routeNo,
        name: route.name,
        areaCovered: route.areaCovered,
        capacity: route.capacity,
        driver: route.driver?.status === 'ACTIVE' ? { name: route.driver.name } : null,
        active: route.trips.length > 0,
        majorStops: (route.schedules[0]?.stops || []).map((entry) => entry.stop),
        assignedPassengerCount: countByRoute.get(route.id) || 0,
        roster: roster ? { name: roster.name, academicYear: roster.academicYear } : null,
      }))
    );
  } catch (error) {
    console.error('[passenger/routes]', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/stops/nearest', async (req, res) => {
  const query = parseNearbyQuery(req.query);
  if (!query) {
    return res.status(400).json({
      error: 'Valid latitude, longitude, radiusMeters (100-50000), and limit (1-20) are required',
    });
  }
  try {
    const stops = await prisma.stop.findMany({
      where: { scheduleStops: { some: { scheduleVersion: { status: 'PUBLISHED' } } } },
      select: {
        id: true,
        name: true,
        latitude: true,
        longitude: true,
        scheduleStops: {
          where: { scheduleVersion: { status: 'PUBLISHED' } },
          orderBy: { sequenceOrder: 'asc' },
          select: {
            scheduledTime: true,
            scheduleVersion: {
              select: {
                direction: true,
                routeService: { select: { id: true, routeNo: true, name: true } },
              },
            },
          },
        },
      },
    });
    const ranked = rankNearestStops(stops, query).map((stop) => {
      const routeMap = new Map();
      for (const entry of stop.scheduleStops) {
        const route = entry.scheduleVersion.routeService;
        const key = `${route.id}:${entry.scheduleVersion.direction}`;
        if (!routeMap.has(key)) {
          routeMap.set(key, { ...route, direction: entry.scheduleVersion.direction, scheduledTime: entry.scheduledTime });
        }
      }
      return {
        id: stop.id,
        name: stop.name,
        latitude: stop.latitude,
        longitude: stop.longitude,
        distanceMeters: stop.distanceMeters,
        routes: [...routeMap.values()],
      };
    });
    return res.json({ query: { radiusMeters: query.radiusMeters }, stops: ranked });
  } catch (error) {
    console.error('[passenger/nearest-stops]', error);
    return res.status(500).json({ error: 'Nearest stops could not be loaded' });
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
            geometryPolyline: true,
            geometryFormat: true,
            geometryDistanceMeters: true,
            geometryDurationSeconds: true,
            geometryGeneratedAt: true,
            geometryProvider: true,
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
module.exports.parseNearbyQuery = parseNearbyQuery;
module.exports.rankNearestStops = rankNearestStops;
