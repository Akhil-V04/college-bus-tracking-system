const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth(['admin']));
router.use((_req, res, next) => { res.setHeader('Cache-Control', 'private, no-store'); next(); });

router.get('/summary', async (_req, res) => {
  try {
    const staleBefore = new Date(Date.now() - 5 * 60 * 1000);
    const [runningTrips, activeLateAlerts, pendingNotifications, failedNotifications, staleRunningTrips, activeAdminSessions] = await Promise.all([
      prisma.trip.count({ where: { status: 'RUNNING' } }),
      prisma.lateAlert.count({ where: { status: 'ACTIVE' } }),
      prisma.notificationOutbox.count({ where: { status: 'PENDING' } }),
      prisma.notificationOutbox.count({ where: { status: 'FAILED' } }),
      prisma.trip.count({ where: { status: 'RUNNING', OR: [{ liveLocations: { none: {} } }, { liveLocations: { none: { acceptedForEta: true, receivedAt: { gte: staleBefore } } } }] } }),
      prisma.adminSession.count({ where: { revokedAt: null, expiresAt: { gt: new Date() } } }),
    ]);
    return res.json({ generatedAt: new Date(), runningTrips, staleRunningTrips, activeLateAlerts, pendingNotifications, failedNotifications, activeAdminSessions });
  } catch (error) {
    console.error('[operations/summary]', error);
    return res.status(503).json({ error: 'Operational summary is temporarily unavailable' });
  }
});

module.exports = router;
