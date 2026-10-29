const express = require('express');
const { rateLimit } = require('express-rate-limit');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');
const { createLimiterStore } = require('../middleware/security');
const { writeAdminAudit } = require('../lib/adminAudit');
const haversineDistance = require('../lib/haversine');
const { enqueueDriverPush } = require('../lib/pushOutbox');

const router = express.Router();
const categories = new Set(['BUS_BREAKDOWN', 'ACCIDENT']);
const terminalStatuses = new Set(['RESOLVED', 'CANCELLED', 'FALSE_REPORT']);
const emergencyStore = createLimiterStore('emergency');
const emergencyLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 6,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many emergency reports. Contact the transport office directly if help is still needed.' },
  passOnStoreError: false,
  ...(emergencyStore ? { store: emergencyStore } : {}),
});

function parseReport(body) {
  const tripId = Number(body?.tripId);
  const category = String(body?.category || '').toUpperCase();
  const description = body?.description == null ? null : String(body.description).trim().slice(0, 1000);
  if (!Number.isInteger(tripId) || tripId <= 0 || !categories.has(category)) return null;
  return { tripId, category, description: description || null };
}

function locationSnapshot(location, now = new Date()) {
  if (!location) return { latitude: null, longitude: null, at: null, source: 'NO_ACCEPTED_GPS' };
  const ageMs = now - new Date(location.receivedAt);
  if (ageMs > 2 * 60 * 1000) {
    return { latitude: null, longitude: null, at: location.receivedAt, source: 'STALE_ACCEPTED_GPS' };
  }
  return {
    latitude: location.latitude,
    longitude: location.longitude,
    at: location.receivedAt,
    source: location.accuracyMeters != null && location.accuracyMeters <= 50
      ? 'ACCEPTED_GPS_HIGH_CONFIDENCE'
      : 'ACCEPTED_GPS_LIMITED_CONFIDENCE',
  };
}

function assistanceAcceptanceOutcome(emergencyStatus, offerStatus) {
  if (terminalStatuses.has(emergencyStatus)) return 'TERMINAL';
  if (offerStatus === 'ACCEPTED') return 'DUPLICATE';
  if (emergencyStatus === 'ASSISTANCE_ACCEPTED') return 'CONFLICT';
  if (offerStatus !== 'OFFERED') return 'CLOSED';
  return 'ACCEPT';
}

async function confirmEmergency(client, emergencyId, confirmedBy) {
  const emergency = await client.emergencyReport.findUnique({
    where: { id: emergencyId },
    include: { trip: { select: { id: true, status: true } } },
  });
  if (!emergency || terminalStatuses.has(emergency.status)) return null;
  const latest = await client.liveLocation.findFirst({
    where: { tripId: emergency.tripId, acceptedForEta: true },
    orderBy: { receivedAt: 'desc' },
  });
  const snapshot = locationSnapshot(latest);
  const candidateTrips = snapshot.latitude == null ? [] : await client.trip.findMany({
    where: {
      status: 'RUNNING', id: { not: emergency.tripId }, driver: { status: 'ACTIVE' },
    },
    select: {
      id: true, driverId: true,
      liveLocations: {
        where: { acceptedForEta: true }, orderBy: { receivedAt: 'desc' }, take: 1,
        select: { latitude: true, longitude: true, receivedAt: true },
      },
    },
  });
  const candidates = candidateTrips
    .map((trip) => {
      const point = trip.liveLocations[0];
      if (!point || new Date() - point.receivedAt > 2 * 60 * 1000) return null;
      return {
        candidateTripId: trip.id,
        candidateDriverId: trip.driverId,
        distanceMeters: haversineDistance(snapshot.latitude, snapshot.longitude, point.latitude, point.longitude),
      };
    })
    .filter((item) => item && item.distanceMeters <= 50000)
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .slice(0, 3);

  return client.$transaction(async (tx) => {
    await tx.$queryRawUnsafe('SELECT "id" FROM "EmergencyReport" WHERE "id" = $1::uuid FOR UPDATE', emergencyId);
    const current = await tx.emergencyReport.findUnique({ where: { id: emergencyId } });
    if (!current || terminalStatuses.has(current.status)) return null;
    if (candidates.length) {
      await tx.emergencyAssistance.createMany({
        data: candidates.map((candidate) => ({ emergencyReportId: emergencyId, ...candidate })),
        skipDuplicates: true,
      });
    }
    const updated = await tx.emergencyReport.update({
      where: { id: emergencyId },
      data: {
        status: candidates.length ? 'ASSISTANCE_REQUESTED' : 'CONFIRMED',
        incidentLatitude: snapshot.latitude,
        incidentLongitude: snapshot.longitude,
        incidentLocationAt: snapshot.at,
        incidentSource: snapshot.source,
        confirmedBy,
        confirmedAt: current.confirmedAt || new Date(),
      },
      include: { assistance: true },
    });
    return updated;
  });
}

router.post('/passenger', emergencyLimiter, async (req, res) => {
  const input = parseReport(req.body);
  if (!input) return res.status(400).json({ error: 'Valid tripId and emergency category are required' });
  const trip = await prisma.trip.findUnique({
    where: { id: input.tripId }, select: { id: true, routeServiceId: true, driverId: true, status: true },
  });
  if (!trip || trip.status !== 'RUNNING') return res.status(409).json({ error: 'Emergency reports require an active trip' });
  const recent = await prisma.emergencyReport.findFirst({
    where: {
      tripId: trip.id, category: input.category, reporterType: 'PASSENGER',
      status: { notIn: ['RESOLVED', 'CANCELLED', 'FALSE_REPORT'] },
      createdAt: { gte: new Date(Date.now() - 5 * 60 * 1000) },
    },
    select: { id: true, category: true, status: true, createdAt: true },
  });
  if (recent) return res.status(202).json({ emergency: recent, duplicate: true });
  const created = await prisma.emergencyReport.create({
    data: { ...input, routeServiceId: trip.routeServiceId, reporterType: 'PASSENGER', status: 'UNVERIFIED' },
    select: { id: true, tripId: true, routeServiceId: true, category: true, status: true, createdAt: true },
  });
  req.app.get('io')?.to(['admin', `driver:${trip.driverId}`]).emit('emergency:unverified', created);
  enqueueDriverPush(trip.driverId, `emergency-unverified:${created.id}`, {
    type: 'EMERGENCY_UNVERIFIED', emergencyId: created.id, tripId: trip.id, category: created.category,
  }).catch(() => console.error('[emergencies/unverified-push] failed'));
  return res.status(201).json({ emergency: created, duplicate: false });
});

router.post('/driver', emergencyLimiter, requireAuth(['driver']), async (req, res) => {
  const input = parseReport(req.body);
  if (!input) return res.status(400).json({ error: 'Valid tripId and emergency category are required' });
  const trip = await prisma.trip.findUnique({
    where: { id: input.tripId },
    include: { driver: { select: { id: true, status: true, sessionVersion: true } } },
  });
  if (!trip || trip.status !== 'RUNNING' || trip.driverId !== Number(req.user.id)) {
    return res.status(403).json({ error: 'Only the current driver can report this trip emergency' });
  }
  if (trip.driver.status !== 'ACTIVE' || trip.driver.sessionVersion !== req.user.sessionVersion) {
    return res.status(401).json({ error: 'Driver session has been revoked' });
  }
  const created = await prisma.emergencyReport.create({
    data: {
      ...input, routeServiceId: trip.routeServiceId, reporterType: 'DRIVER',
      reporterDriverId: trip.driverId, status: 'CONFIRMED',
    },
  });
  const confirmed = await confirmEmergency(prisma, created.id, `driver:${trip.driverId}`);
  req.app.get('io')?.to(['admin', `trip:${trip.id}`]).emit('emergency:confirmed', confirmed);
  for (const offer of confirmed?.assistance || []) {
    req.app.get('io')?.to(`driver:${offer.candidateDriverId}`).emit('emergency:assistance-offer', {
      emergencyId: confirmed.id, offerId: offer.id, distanceMeters: offer.distanceMeters,
    });
    enqueueDriverPush(offer.candidateDriverId, `emergency-offer:${offer.id}`, {
      type: 'EMERGENCY_ASSISTANCE_OFFER', emergencyId: confirmed.id,
      offerId: offer.id, distanceMeters: offer.distanceMeters,
    }).catch(() => console.error('[emergencies/offer-push] failed'));
  }
  return res.status(201).json({ emergency: confirmed });
});

// GET /nearby-buses: Allows driver to see which route buses are near him (max 3 only)
router.get('/nearby-buses', requireAuth(['driver']), async (req, res) => {
  const tripId = Number(req.query.tripId);
  if (!Number.isInteger(tripId) || tripId <= 0) {
    return res.status(400).json({ error: 'Valid tripId is required' });
  }

  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: {
      routeService: { select: { id: true, routeNo: true, name: true } },
      driver: { select: { id: true, name: true, status: true, sessionVersion: true } },
    },
  });

  if (!trip || trip.status !== 'RUNNING' || trip.driverId !== Number(req.user.id)) {
    return res.status(403).json({ error: 'Trip is not running or belongs to another driver' });
  }

  // Get driver's latest GPS coordinate
  const myLatest = await prisma.liveLocation.findFirst({
    where: { tripId: trip.id },
    orderBy: { receivedAt: 'desc' },
  });

  if (!myLatest) {
    return res.json({
      gpsActive: false,
      message: 'Live GPS location is not available yet. Please share live GPS first.',
      nearbyBuses: [],
    });
  }

  // Find other active RUNNING trips
  const otherTrips = await prisma.trip.findMany({
    where: {
      status: 'RUNNING',
      id: { not: trip.id },
      driver: { status: 'ACTIVE' },
    },
    select: {
      id: true,
      driverId: true,
      routeService: { select: { id: true, routeNo: true, name: true } },
      driver: { select: { id: true, name: true, phone: true } },
      liveLocations: {
        orderBy: { receivedAt: 'desc' },
        take: 1,
        select: { latitude: true, longitude: true, receivedAt: true },
      },
    },
  });

  const nearby = otherTrips
    .map((other) => {
      const point = other.liveLocations[0];
      if (!point) return null;
      const dist = haversineDistance(myLatest.latitude, myLatest.longitude, point.latitude, point.longitude);
      return {
        tripId: other.id,
        routeId: other.routeService.id,
        routeNo: other.routeService.routeNo,
        routeName: other.routeService.name,
        driverId: other.driverId,
        driverName: other.driver.name,
        driverPhone: other.driver.phone,
        distanceMeters: Math.round(dist),
        distanceKm: Number((dist / 1000).toFixed(1)),
        latitude: point.latitude,
        longitude: point.longitude,
        lastSeenAt: point.receivedAt,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .slice(0, 3); // MAX 3 ONLY!

  return res.json({
    gpsActive: true,
    myLocation: {
      latitude: myLatest.latitude,
      longitude: myLatest.longitude,
      receivedAt: myLatest.receivedAt,
    },
    nearbyBuses: nearby,
  });
});

// POST /driver/breakdown: Reports breakdown and sends alert to ONLY the max 3 nearest drivers and the admin panel
router.post('/driver/breakdown', requireAuth(['driver']), async (req, res) => {
  const tripId = Number(req.body?.tripId);
  const description = req.body?.description
    ? String(req.body.description).trim().slice(0, 500)
    : 'Bus breakdown reported by driver - stopped on route';

  if (!Number.isInteger(tripId) || tripId <= 0) {
    return res.status(400).json({ error: 'Valid tripId is required' });
  }

  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: {
      routeService: { select: { id: true, routeNo: true, name: true } },
      driver: { select: { id: true, name: true, phone: true, status: true, sessionVersion: true } },
    },
  });

  if (!trip || trip.status !== 'RUNNING' || trip.driverId !== Number(req.user.id)) {
    return res.status(403).json({ error: 'Only the current active driver can report breakdown for this running trip' });
  }

  if (trip.driver.status !== 'ACTIVE' || trip.driver.sessionVersion !== req.user.sessionVersion) {
    return res.status(401).json({ error: 'Driver session has been revoked' });
  }

  // Live GPS must be sharing
  const latestLocation = await prisma.liveLocation.findFirst({
    where: { tripId: trip.id },
    orderBy: { receivedAt: 'desc' },
  });

  if (!latestLocation) {
    return res.status(409).json({
      error: 'Cannot report bus breakdown: Live GPS is not sharing yet. Please share live GPS so nearest buses and exact location can be identified.'
    });
  }

  const snapshot = locationSnapshot(latestLocation);

  // Find other RUNNING trips with live locations
  const candidateTrips = await prisma.trip.findMany({
    where: {
      status: 'RUNNING',
      id: { not: trip.id },
      driver: { status: 'ACTIVE' },
    },
    select: {
      id: true,
      driverId: true,
      routeService: { select: { id: true, routeNo: true, name: true } },
      driver: { select: { id: true, name: true, phone: true } },
      liveLocations: {
        orderBy: { receivedAt: 'desc' },
        take: 1,
        select: { latitude: true, longitude: true, receivedAt: true },
      },
    },
  });

  const candidatesWithDistance = candidateTrips
    .map((other) => {
      const point = other.liveLocations[0];
      if (!point) return null;
      const dist = haversineDistance(
        snapshot.latitude || latestLocation.latitude,
        snapshot.longitude || latestLocation.longitude,
        point.latitude,
        point.longitude
      );
      return {
        candidateTripId: other.id,
        candidateDriverId: other.driverId,
        routeNo: other.routeService.routeNo,
        routeName: other.routeService.name,
        driverName: other.driver.name,
        driverPhone: other.driver.phone,
        distanceMeters: Math.round(dist),
        distanceKm: Number((dist / 1000).toFixed(1)),
      };
    })
    .filter((item) => item && item.distanceMeters <= 50000)
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .slice(0, 3); // STRICTLY MAX 3 ONLY!

  // Create EmergencyReport in DB
  const created = await prisma.emergencyReport.create({
    data: {
      category: 'BUS_BREAKDOWN',
      reporterType: 'DRIVER',
      reporterDriverId: trip.driverId,
      tripId: trip.id,
      routeServiceId: trip.routeServiceId,
      status: candidatesWithDistance.length > 0 ? 'ASSISTANCE_REQUESTED' : 'CONFIRMED',
      description,
      incidentLatitude: snapshot.latitude || latestLocation.latitude,
      incidentLongitude: snapshot.longitude || latestLocation.longitude,
      incidentLocationAt: snapshot.at || latestLocation.receivedAt,
      incidentSource: snapshot.source,
      confirmedBy: `driver:${trip.driverId}`,
      confirmedAt: new Date(),
    },
  });

  // Create assistance offers for only these 3 drivers
  if (candidatesWithDistance.length > 0) {
    await prisma.emergencyAssistance.createMany({
      data: candidatesWithDistance.map((c) => ({
        emergencyReportId: created.id,
        candidateTripId: c.candidateTripId,
        candidateDriverId: c.candidateDriverId,
        distanceMeters: c.distanceMeters,
        status: 'OFFERED',
      })),
      skipDuplicates: true,
    });
  }

  // Also create or link an urgent Issue so admin panel AI Issue clusters records it
  try {
    await prisma.issue.create({
      data: {
        title: `Bus Breakdown: Route ${trip.routeService.routeNo} (${trip.driver.name})`,
        summary: `Driver reported bus breakdown on Route ${trip.routeService.routeNo}. Assistance requested from ${candidatesWithDistance.length} nearby bus(es).`,
        category: 'BUS_CONDITION',
        priority: 'URGENT',
        status: 'OPEN',
        routeServiceId: trip.routeServiceId,
        tripId: trip.id,
      },
    });
  } catch (_e) {
    // Non-blocking
  }

  const fullEmergency = await prisma.emergencyReport.findUnique({
    where: { id: created.id },
    include: {
      routeService: { select: { routeNo: true, name: true } },
      assistance: true,
      reporterDriver: { select: { id: true, name: true, phone: true } },
    },
  });

  const io = req.app.get('io');

  // 1. Send breakdown notification to ONLY those max 3 nearest drivers!
  for (const candidate of candidatesWithDistance) {
    io?.to(`driver:${candidate.candidateDriverId}`).emit('driver:breakdown_alert', {
      emergencyId: created.id,
      brokenDownTripId: trip.id,
      brokenDownRouteNo: trip.routeService.routeNo,
      brokenDownRouteName: trip.routeService.name,
      brokenDownDriverName: trip.driver.name,
      brokenDownDriverPhone: trip.driver.phone,
      distanceKm: candidate.distanceKm,
      distanceMeters: candidate.distanceMeters,
      location: {
        latitude: snapshot.latitude || latestLocation.latitude,
        longitude: snapshot.longitude || latestLocation.longitude,
      },
      description,
      timestamp: new Date().toISOString(),
    });

    enqueueDriverPush(candidate.candidateDriverId, `emergency-breakdown:${created.id}`, {
      type: 'BREAKDOWN_ALERT',
      emergencyId: created.id,
      routeNo: trip.routeService.routeNo,
      distanceKm: candidate.distanceKm,
    }).catch(() => undefined);
  }

  // 2. Send notification to the ADMIN PANEL!
  io?.to('admin').emit('admin:breakdown_alert', {
    emergencyId: created.id,
    tripId: trip.id,
    routeNo: trip.routeService.routeNo,
    routeName: trip.routeService.name,
    driverName: trip.driver.name,
    driverPhone: trip.driver.phone,
    location: {
      latitude: snapshot.latitude || latestLocation.latitude,
      longitude: snapshot.longitude || latestLocation.longitude,
    },
    notifiedBuses: candidatesWithDistance,
    description,
    timestamp: new Date().toISOString(),
  });

  // Also broadcast standard emergency:confirmed to admin and trip rooms
  io?.to(['admin', `trip:${trip.id}`]).emit('emergency:confirmed', fullEmergency);

  return res.status(201).json({
    success: true,
    emergency: fullEmergency,
    notifiedBuses: candidatesWithDistance,
    message: `Breakdown reported successfully. Alerted ${candidatesWithDistance.length} nearest bus(es) and Transport Admin.`,
  });
});

// GET /active: Get active emergencies/breakdowns
router.get('/active', async (_req, res) => {
  const activeEmergencies = await prisma.emergencyReport.findMany({
    where: {
      status: { notIn: ['RESOLVED', 'CANCELLED', 'FALSE_REPORT'] },
      createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
    include: {
      routeService: { select: { routeNo: true, name: true } },
      reporterDriver: { select: { name: true, phone: true } },
      assistance: {
        include: {
          candidateDriver: { select: { name: true, phone: true } },
          candidateTrip: { include: { routeService: { select: { routeNo: true } } } },
        },
      },
    },
  });

  return res.json(activeEmergencies);
});

router.post('/:id/offers/:offerId/respond', requireAuth(['driver']), async (req, res) => {
  const driver = await prisma.driver.findUnique({
    where: { id: Number(req.user.id) }, select: { status: true, sessionVersion: true },
  });
  if (!driver || driver.status !== 'ACTIVE' || driver.sessionVersion !== req.user.sessionVersion) {
    return res.status(401).json({ error: 'Driver session has been revoked' });
  }
  const decision = String(req.body?.decision || '').toUpperCase();
  if (!['ACCEPT', 'DECLINE'].includes(decision)) return res.status(400).json({ error: 'decision must be ACCEPT or DECLINE' });
  const offer = await prisma.emergencyAssistance.findFirst({
    where: { id: String(req.params.offerId), emergencyReportId: String(req.params.id), candidateDriverId: Number(req.user.id) },
    include: {
      candidateTrip: { select: { status: true, driverId: true } },
      emergency: { include: { trip: { select: { driverId: true } } } },
    },
  });
  if (!offer) return res.status(404).json({ error: 'Assistance offer not found' });
  if (offer.status !== 'OFFERED') return res.json({ offerId: offer.id, status: offer.status, duplicate: true });
  if (decision === 'DECLINE') {
    const updated = await prisma.emergencyAssistance.update({
      where: { id: offer.id }, data: { status: 'DECLINED', respondedAt: new Date() },
    });
    return res.json({ offerId: updated.id, status: updated.status });
  }
  if (req.body?.safelyStopped !== true || offer.candidateTrip.status !== 'RUNNING' || offer.candidateTrip.driverId !== Number(req.user.id)) {
    return res.status(409).json({ error: 'The candidate bus must be active and safely stopped before accepting' });
  }
  const latest = await prisma.liveLocation.findFirst({
    where: { tripId: offer.candidateTripId, acceptedForEta: true }, orderBy: { receivedAt: 'desc' },
    select: { receivedAt: true, deviceSpeedKmh: true },
  });
  if (!latest || new Date() - latest.receivedAt > 2 * 60 * 1000 || latest.deviceSpeedKmh == null || latest.deviceSpeedKmh > 5) {
    return res.status(409).json({ error: 'A recent accepted GPS sample confirming low speed is required' });
  }
  try {
    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRawUnsafe('SELECT "id" FROM "EmergencyReport" WHERE "id" = $1::uuid FOR UPDATE', String(req.params.id));
      const currentEmergency = await tx.emergencyReport.findUnique({
        where: { id: String(req.params.id) }, select: { status: true },
      });
      const current = await tx.emergencyAssistance.findUnique({ where: { id: offer.id } });
      if (!currentEmergency || !current) return { outcome: 'MISSING', offer: null };
      const outcome = assistanceAcceptanceOutcome(currentEmergency.status, current.status);
      if (outcome !== 'ACCEPT') return { outcome, offer: current };
      const updated = await tx.emergencyAssistance.update({
        where: { id: offer.id }, data: { status: 'ACCEPTED', respondedAt: new Date() },
      });
      await tx.emergencyAssistance.updateMany({
        where: { emergencyReportId: String(req.params.id), id: { not: offer.id }, status: 'OFFERED' },
        data: { status: 'CLOSED' },
      });
      await tx.emergencyReport.update({
        where: { id: String(req.params.id) }, data: { status: 'ASSISTANCE_ACCEPTED' },
      });
      return { outcome: 'ACCEPTED', offer: updated };
    }, { isolationLevel: 'Serializable' });
    if (result.outcome === 'CONFLICT') {
      return res.status(409).json({ error: 'Another driver already accepted this emergency' });
    }
    if (result.outcome !== 'ACCEPTED') {
      return res.json({
        offerId: result.offer?.id || offer.id,
        status: result.offer?.status || 'CLOSED',
        duplicate: true,
      });
    }
    const accepted = result.offer;
    req.app.get('io')?.to(['admin', `trip:${offer.candidateTripId}`]).emit('emergency:assistance-accepted', {
      emergencyId: String(req.params.id), offerId: accepted.id, assistingDriverId: Number(req.user.id),
    });
    enqueueDriverPush(offer.emergency.trip.driverId, `emergency-accepted:${offer.emergencyReportId}`, {
      type: 'EMERGENCY_ASSISTANCE_ACCEPTED', emergencyId: offer.emergencyReportId,
      assistingDriverId: Number(req.user.id),
    }).catch(() => console.error('[emergencies/accepted-push] failed'));
    return res.json({ offerId: accepted.id, status: accepted.status });
  } catch (error) {
    if (error.code === 'P2002' || error.code === 'P2034') {
      return res.status(409).json({ error: 'Another driver already accepted this emergency' });
    }
    console.error('[emergencies/accept]', error);
    return res.status(500).json({ error: 'Assistance response could not be recorded' });
  }
});

router.use(requireAuth(['admin']));

router.get('/', async (req, res) => {
  const items = await prisma.emergencyReport.findMany({
    orderBy: { createdAt: 'desc' }, take: 100,
    include: { routeService: { select: { routeNo: true, name: true } }, assistance: true },
  });
  return res.json(items);
});

router.post('/:id/confirm', async (req, res) => {
  const before = await prisma.emergencyReport.findUnique({ where: { id: String(req.params.id) } });
  if (!before) return res.status(404).json({ error: 'Emergency not found' });
  if (before.status !== 'UNVERIFIED') return res.status(409).json({ error: 'Only an unverified emergency can be confirmed' });
  const updated = await confirmEmergency(prisma, before.id, String(req.user.id));
  await prisma.$transaction((tx) => writeAdminAudit(tx, req, {
    action: 'EMERGENCY_CONFIRMED', entityType: 'EmergencyReport', entityId: before.id,
    beforeSummary: { status: before.status, category: before.category, tripId: before.tripId },
    afterSummary: { status: updated.status, incidentSource: updated.incidentSource, offers: updated.assistance.length },
  }));
  req.app.get('io')?.to(['admin', `trip:${before.tripId}`]).emit('emergency:confirmed', updated);
  for (const offer of updated.assistance) {
    req.app.get('io')?.to(`driver:${offer.candidateDriverId}`).emit('emergency:assistance-offer', {
      emergencyId: updated.id, offerId: offer.id, distanceMeters: offer.distanceMeters,
    });
    enqueueDriverPush(offer.candidateDriverId, `emergency-offer:${offer.id}`, {
      type: 'EMERGENCY_ASSISTANCE_OFFER', emergencyId: updated.id,
      offerId: offer.id, distanceMeters: offer.distanceMeters,
    }).catch(() => console.error('[emergencies/offer-push] failed'));
  }
  return res.json(updated);
});

router.post('/:id/reopen-assistance', async (req, res) => {
  if (req.body?.confirmed !== true) {
    return res.status(409).json({ error: 'Explicit confirmation is required to reopen assistance' });
  }
  const reason = String(req.body?.reason || '').trim().slice(0, 500);
  if (!reason) return res.status(400).json({ error: 'A reassignment reason is required' });
  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRawUnsafe('SELECT "id" FROM "EmergencyReport" WHERE "id" = $1::uuid FOR UPDATE', String(req.params.id));
    const before = await tx.emergencyReport.findUnique({
      where: { id: String(req.params.id) },
      include: {
        assistance: {
          include: {
            candidateTrip: { select: { status: true, driverId: true } },
            candidateDriver: { select: { status: true } },
          },
        },
      },
    });
    if (!before) return { statusCode: 404 };
    if (before.status !== 'ASSISTANCE_ACCEPTED') return { statusCode: 409 };

    const reopenIds = before.assistance
      .filter((item) => item.status === 'CLOSED' &&
        item.candidateTrip.status === 'RUNNING' &&
        item.candidateTrip.driverId === item.candidateDriverId &&
        item.candidateDriver.status === 'ACTIVE')
      .map((item) => item.id);
    await tx.emergencyAssistance.updateMany({
      where: { emergencyReportId: before.id, status: 'ACCEPTED' },
      data: { status: 'CLOSED' },
    });
    if (reopenIds.length) {
      await tx.emergencyAssistance.updateMany({
        where: { id: { in: reopenIds } },
        data: { status: 'OFFERED', respondedAt: null },
      });
    }
    const status = reopenIds.length ? 'ASSISTANCE_REQUESTED' : 'CONFIRMED';
    const updated = await tx.emergencyReport.update({
      where: { id: before.id }, data: { status },
    });
    await writeAdminAudit(tx, req, {
      action: 'EMERGENCY_ASSISTANCE_REOPENED', entityType: 'EmergencyReport', entityId: before.id,
      beforeSummary: { status: before.status },
      afterSummary: { status, reopenedOffers: reopenIds.length, reason },
    });
    return { statusCode: 200, emergency: updated, reopenIds };
  }, { isolationLevel: 'Serializable' });
  if (result.statusCode === 404) return res.status(404).json({ error: 'Emergency not found' });
  if (result.statusCode === 409) {
    return res.status(409).json({ error: 'Only an accepted assistance assignment can be reopened' });
  }
  if (result.reopenIds.length) {
    const reopened = await prisma.emergencyAssistance.findMany({
      where: { id: { in: result.reopenIds } },
      select: { id: true, candidateDriverId: true, distanceMeters: true },
    });
    for (const offer of reopened) {
      req.app.get('io')?.to(`driver:${offer.candidateDriverId}`).emit('emergency:assistance-offer', {
        emergencyId: result.emergency.id, offerId: offer.id, distanceMeters: offer.distanceMeters,
        reassigned: true,
      });
      enqueueDriverPush(offer.candidateDriverId, `emergency-reopened:${result.emergency.id}:${offer.id}`, {
        type: 'EMERGENCY_ASSISTANCE_REOPENED', emergencyId: result.emergency.id,
        offerId: offer.id, distanceMeters: offer.distanceMeters,
      }).catch(() => console.error('[emergencies/reopened-push] failed'));
    }
  }
  return res.json({
    emergencyId: result.emergency.id,
    status: result.emergency.status,
    reopenedOffers: result.reopenIds.length,
  });
});

router.patch('/:id/status', async (req, res) => {
  const status = String(req.body?.status || '').toUpperCase();
  if (!terminalStatuses.has(status)) return res.status(400).json({ error: 'status must be RESOLVED, CANCELLED, or FALSE_REPORT' });
  const updated = await prisma.$transaction(async (tx) => {
    const before = await tx.emergencyReport.findUnique({ where: { id: String(req.params.id) } });
    if (!before) return null;
    const item = await tx.emergencyReport.update({
      where: { id: before.id }, data: { status, resolvedAt: new Date() },
    });
    await tx.emergencyAssistance.updateMany({
      where: { emergencyReportId: before.id, status: 'OFFERED' }, data: { status: 'CLOSED' },
    });
    await writeAdminAudit(tx, req, {
      action: 'EMERGENCY_STATUS_CHANGED', entityType: 'EmergencyReport', entityId: before.id,
      beforeSummary: { status: before.status, category: before.category },
      afterSummary: { status: item.status, category: item.category },
    });
    return item;
  });
  if (!updated) return res.status(404).json({ error: 'Emergency not found' });
  return res.json(updated);
});

module.exports = router;
module.exports.assistanceAcceptanceOutcome = assistanceAcceptanceOutcome;
module.exports.locationSnapshot = locationSnapshot;
module.exports.parseReport = parseReport;
