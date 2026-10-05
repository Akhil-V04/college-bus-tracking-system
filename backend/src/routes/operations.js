const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth(['admin']));
router.use((_req, res, next) => { res.setHeader('Cache-Control', 'private, no-store'); next(); });

router.get('/summary', async (_req, res) => {
  try {
    const staleBefore = new Date(Date.now() - 5 * 60 * 1000);
    const [snapshot] = await prisma.$queryRaw`
      SELECT
        (SELECT COUNT(*)::int FROM "Trip" WHERE "status" = 'RUNNING') AS "runningTrips",
        (SELECT COUNT(*)::int FROM "Trip" t WHERE t."status" = 'RUNNING' AND NOT EXISTS (
          SELECT 1 FROM "LiveLocation" l WHERE l."tripId" = t."id"
            AND l."acceptedForEta" = true AND l."receivedAt" >= ${staleBefore}
        )) AS "staleRunningTrips",
        (SELECT COUNT(*)::int FROM "LateAlert" WHERE "status" = 'ACTIVE') AS "activeLateAlerts",
        (SELECT COUNT(*)::int FROM "NotificationOutbox" WHERE "status" = 'PENDING') AS "pendingNotifications",
        (SELECT COUNT(*)::int FROM "NotificationOutbox" WHERE "status" = 'FAILED') AS "failedNotifications",
        (SELECT COUNT(*)::int FROM "PushNotificationOutbox" WHERE "status" = 'PENDING') AS "pendingPushNotifications",
        (SELECT COUNT(*)::int FROM "PushNotificationOutbox" WHERE "status" = 'FAILED') AS "failedPushNotifications",
        (SELECT COUNT(*)::int FROM "PushDeviceSubscription" WHERE "active" = true
          AND ("expiresAt" IS NULL OR "expiresAt" > NOW())) AS "activePushSubscriptions",
        (SELECT COUNT(*)::int FROM "FeedbackReport" WHERE "status" IN ('NEW', 'UNDER_REVIEW')) AS "unresolvedFeedback",
        (SELECT COUNT(*)::int FROM "EmergencyReport" WHERE "status" NOT IN ('RESOLVED', 'CANCELLED', 'FALSE_REPORT')) AS "activeEmergencies",
        (SELECT COUNT(*)::int FROM "EmergencyReport" WHERE "status" = 'UNVERIFIED') AS "unverifiedEmergencies",
        (SELECT COUNT(*)::int FROM "EmergencyAssistance" WHERE "status" = 'OFFERED') AS "openAssistanceOffers",
        (SELECT COUNT(*)::int FROM "AdminSession" WHERE "revokedAt" IS NULL AND "expiresAt" > NOW()) AS "activeAdminSessions"
    `;
    return res.json({
      generatedAt: new Date(),
      ...snapshot,
    });
  } catch (error) {
    console.error('[operations/summary]', error);
    return res.status(503).json({ error: 'Operational summary is temporarily unavailable' });
  }
});

router.get('/lateness', async (req, res) => {
  const routeNo = req.query.routeNo == null ? null : String(req.query.routeNo).trim();
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  try {
    const trips = await prisma.trip.findMany({
      where: {
        status: 'COMPLETED',
        ...(routeNo ? { routeService: { routeNo } } : {}),
      },
      orderBy: { endTime: 'desc' },
      take: 1000,
      select: {
        id: true,
        date: true,
        actualCollegeArrivalAt: true,
        collegeDeadlineAt: true,
        actualDelayMinutes: true,
        routeService: { select: { routeNo: true, name: true } },
      },
    });
    const verified = trips.filter((trip) => trip.actualCollegeArrivalAt && trip.collegeDeadlineAt && trip.actualDelayMinutes != null);
    const delays = verified.map((trip) => trip.actualDelayMinutes).sort((a, b) => a - b);
    const middle = Math.floor(delays.length / 2);
    const medianDelayMinutes = delays.length
      ? (delays.length % 2 ? delays[middle] : (delays[middle - 1] + delays[middle]) / 2)
      : null;
    const lateTrips = verified.filter((trip) => trip.actualDelayMinutes > 0);
    return res.json({
      routeNo,
      completedTrips: trips.length,
      verifiedArrivalTrips: verified.length,
      unknownArrivalTrips: trips.length - verified.length,
      actualLateTrips: lateTrips.length,
      latePercentage: verified.length ? Math.round((lateTrips.length / verified.length) * 10000) / 100 : null,
      averageActualDelayMinutes: delays.length
        ? Math.round((delays.reduce((sum, value) => sum + value, 0) / delays.length) * 100) / 100
        : null,
      medianActualDelayMinutes: medianDelayMinutes,
      recent: verified.slice(0, limit),
    });
  } catch (error) {
    console.error('[operations/lateness]', error);
    return res.status(503).json({ error: 'Lateness analytics are temporarily unavailable' });
  }
});

module.exports = router;
