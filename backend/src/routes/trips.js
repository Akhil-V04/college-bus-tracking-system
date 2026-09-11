const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');
const { estimateArrival } = require('../lib/eta');
const { clearTripObservation, deadlineForToday } = require('../lib/lateAlert');
const { writeAdminAudit } = require('../lib/adminAudit');
const { locationFreshness } = require('../lib/liveTracking');
const { aggregateTripSegments } = require('../lib/segmentStatistics');

const router = express.Router();

async function assertDriverSession(user) {
  if (user.role !== 'driver') return null;
  const driver = await prisma.driver.findUnique({
    where: { id: Number(user.id) },
    select: { id: true, sessionVersion: true, status: true },
  });
  if (!driver || driver.status !== 'ACTIVE' || driver.sessionVersion !== user.sessionVersion) return false;
  return driver;
}

function buildRouteSnapshot(route) {
  return {
    id: route.id,
    routeNo: route.routeNo,
    name: route.name,
    areaCovered: route.areaCovered,
    capacity: route.capacity,
  };
}

function buildScheduleSnapshot(schedule) {
  return {
    id: schedule.id,
    name: schedule.name,
    direction: schedule.direction,
    version: schedule.version,
    geometryPolyline: schedule.geometryPolyline,
    geometryFormat: schedule.geometryFormat,
    geometryFingerprint: schedule.geometryFingerprint,
    stops: schedule.stops.map((entry) => ({
      scheduleStopId: entry.id,
      stopId: entry.stopId,
      sequenceOrder: entry.sequenceOrder,
      scheduledTime: entry.scheduledTime,
      name: entry.stop.name,
      latitude: entry.stop.latitude,
      longitude: entry.stop.longitude,
    })),
  };
}

function buildOperationalRosterSnapshot(roster, passengers) {
  const students = passengers
    .filter((passenger) => passenger.passengerType === 'STUDENT')
    .map((passenger) => ({
      name: passenger.name,
      rollNo: passenger.rollNo,
      department: passenger.department,
      year: passenger.year,
      section: passenger.section,
      boardingStopId: passenger.boardingStopId,
    }));
  return {
    rosterId: roster.id,
    academicYear: roster.academicYear,
    passengerCount: passengers.length,
    studentCount: students.length,
    facultyCount: passengers.length - students.length,
    students,
  };
}

function compactRosterSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return null;
  return {
    rosterId: snapshot.rosterId || null,
    academicYear: snapshot.academicYear || null,
    passengerCount: Number(snapshot.passengerCount || 0),
    studentCount: Number(snapshot.studentCount || 0),
    facultyCount: Number(snapshot.facultyCount || 0),
  };
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
      select: {
        id: true,
        routeNo: true,
        name: true,
        areaCovered: true,
        capacity: true,
        driverId: true,
        driver: { select: { status: true } },
      },
    });
    if (!route) return res.status(404).json({ error: 'No matching route assignment was found' });
    if (route.driver?.status !== 'ACTIVE') return res.status(409).json({ error: 'The assigned driver is inactive' });

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
        select: { id: true, academicYear: true },
      }),
      prisma.scheduleVersion.findFirst({
        where: { routeServiceId: route.id, status: 'PUBLISHED' },
        orderBy: { publishedAt: 'desc' },
        include: {
          stops: { orderBy: { sequenceOrder: 'asc' }, include: { stop: true } },
        },
      }),
    ]);
    if (!roster) return res.status(409).json({ error: 'A passenger roster must be published before starting trips' });
    if (!schedule) return res.status(409).json({ error: 'A route schedule must be published before starting this trip' });
    if (!schedule.geometryPolyline) {
      return res.status(409).json({ error: 'Published route geometry is not ready for this trip' });
    }

    const passengers = await prisma.rosterPassenger.findMany({
      where: { rosterId: roster.id, routeServiceId: route.id },
      select: {
        passengerType: true,
        name: true,
        rollNo: true,
        department: true,
        year: true,
        section: true,
        boardingStopId: true,
      },
      orderBy: [{ passengerType: 'asc' }, { name: 'asc' }],
    });

    const now = new Date();
    const routeSnapshot = buildRouteSnapshot(route);
    const scheduleSnapshot = buildScheduleSnapshot(schedule);
    const rosterSnapshot = buildOperationalRosterSnapshot(roster, passengers);
    const trip = await prisma.$transaction(async (tx) => {
      const created = await tx.trip.create({
        data: {
          routeServiceId: route.id,
          driverId,
          rosterId: roster.id,
          scheduleVersionId: schedule.id,
          date: now,
          startTime: now,
          collegeDeadlineAt: deadlineForToday(now),
          routeSnapshot,
          scheduleSnapshot,
          rosterSnapshot,
          rosterSnapshotKind: 'OPERATIONAL',
          snapshotCapturedAt: now,
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
    select: {
      id: true,
      driverId: true,
      routeServiceId: true,
      status: true,
      endTime: true,
      collegeDeadlineAt: true,
      rosterSnapshot: true,
      scheduleVersion: {
        select: { stops: { orderBy: { sequenceOrder: 'asc' }, select: { id: true } } },
      },
    },
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
    await tx.$queryRawUnsafe('SELECT "id" FROM "Trip" WHERE "id" = $1 FOR UPDATE', id);
    const locked = await tx.trip.findUnique({
      where: { id },
      select: { driverId: true, status: true, collegeDeadlineAt: true, rosterSnapshot: true },
    });
    if (req.user.role === 'driver' && locked?.driverId !== Number(req.user.id)) {
      throw Object.assign(new Error('Trip ownership changed'), { code: 'TRIP_OWNERSHIP_CHANGED' });
    }
    if (!locked || locked.status !== 'RUNNING') {
      return { completed: await tx.trip.findUnique({ where: { id } }), changed: false };
    }
    const finalScheduleStopId = trip.scheduleVersion.stops.at(-1)?.id;
    const arrival = finalScheduleStopId
      ? await tx.tripStopEvent.findUnique({
          where: { tripId_scheduleStopId: { tripId: id, scheduleStopId: finalScheduleStopId } },
          select: { status: true, detectedAt: true },
        })
      : null;
    const actualCollegeArrivalAt = arrival?.status === 'REACHED' ? arrival.detectedAt : null;
    const actualDelayMinutes = actualCollegeArrivalAt && locked.collegeDeadlineAt
      ? Math.ceil((actualCollegeArrivalAt.getTime() - locked.collegeDeadlineAt.getTime()) / 60000)
      : null;
    const changed = await tx.trip.updateMany({
      where: { id, status: 'RUNNING', driverId: locked.driverId },
      data: {
        status: 'COMPLETED',
        endTime: new Date(),
        actualCollegeArrivalAt,
        actualDelayMinutes,
        rosterSnapshot: compactRosterSnapshot(locked.rosterSnapshot),
        rosterSnapshotKind: 'COMPACT',
      },
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
  }).catch((error) => {
    if (error.code === 'TRIP_OWNERSHIP_CHANGED') return { ownershipChanged: true };
    throw error;
  });

  if (result.ownershipChanged) {
    return res.status(403).json({ error: 'This trip was transferred to another driver' });
  }

  if (result.changed) {
    clearTripObservation(id);
    try {
      await aggregateTripSegments(id);
    } catch (error) {
      console.error('[trips/segment-aggregation]', error);
    }
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

router.post('/:id/transfer', requireAuth(['admin']), async (req, res) => {
  const id = Number(req.params.id);
  const toDriverId = Number(req.body?.toDriverId);
  const reason = req.body?.reason == null ? null : String(req.body.reason).trim().slice(0, 500);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid trip ID' });
  if (!Number.isInteger(toDriverId) || toDriverId <= 0) {
    return res.status(400).json({ error: 'A valid toDriverId is required' });
  }
  if (req.body?.confirmed !== true) {
    return res.status(400).json({ error: 'confirmed must be true for an active-trip transfer' });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRawUnsafe('SELECT "id" FROM "Trip" WHERE "id" = $1 FOR UPDATE', id);
      const trip = await tx.trip.findUnique({
        where: { id },
        select: { id: true, status: true, driverId: true, routeServiceId: true },
      });
      if (!trip) return { statusCode: 404 };
      if (trip.status !== 'RUNNING') return { statusCode: 409, error: 'Only a running trip can be transferred' };
      if (trip.driverId === toDriverId) return { statusCode: 409, error: 'The replacement driver already owns this trip' };
      const replacement = await tx.driver.findUnique({
        where: { id: toDriverId },
        select: { id: true, driverCode: true, name: true, status: true },
      });
      if (!replacement) return { statusCode: 404, error: 'Replacement driver not found' };
      if (replacement.status !== 'ACTIVE') return { statusCode: 409, error: 'Replacement driver is inactive' };
      const conflict = await tx.trip.findFirst({
        where: { driverId: toDriverId, status: 'RUNNING', id: { not: id } },
        select: { id: true },
      });
      if (conflict) return { statusCode: 409, error: 'Replacement driver already has a running trip' };

      const updated = await tx.trip.update({ where: { id }, data: { driverId: toDriverId } });
      const transfer = await tx.tripDriverTransfer.create({
        data: {
          tripId: id,
          fromDriverId: trip.driverId,
          toDriverId,
          adminIdentifier: String(req.user.id),
          reason: reason || null,
        },
      });
      await writeAdminAudit(tx, req, {
        action: 'ACTIVE_TRIP_TRANSFERRED',
        entityType: 'Trip',
        entityId: id,
        beforeSummary: { driverId: trip.driverId, status: trip.status },
        afterSummary: { driverId: toDriverId, status: updated.status, transferId: transfer.id, reason: reason || null },
      });
      return { statusCode: 200, updated, replacement, transfer };
    }, { isolationLevel: 'Serializable' });

    if (result.statusCode !== 200) {
      return res.status(result.statusCode).json({ error: result.error || 'Trip or driver not found' });
    }
    req.app.get('io')?.to(['trip:' + id, 'route:' + result.updated.routeServiceId]).emit('trip:transferred', {
      tripId: id,
      fromDriverId: result.transfer.fromDriverId,
      toDriverId,
      transferredAt: result.transfer.createdAt,
    });
    return res.json({
      tripId: id,
      driver: result.replacement,
      transferredAt: result.transfer.createdAt,
    });
  } catch (error) {
    if (error.code === 'P2034') {
      return res.status(409).json({ error: 'The trip changed during transfer; reload and confirm again' });
    }
    console.error('[trips/transfer]', error);
    return res.status(500).json({ error: 'Active trip could not be transferred' });
  }
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
module.exports.buildRouteSnapshot = buildRouteSnapshot;
module.exports.buildScheduleSnapshot = buildScheduleSnapshot;
module.exports.buildOperationalRosterSnapshot = buildOperationalRosterSnapshot;
module.exports.compactRosterSnapshot = compactRosterSnapshot;
