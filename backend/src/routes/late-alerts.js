const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');
const { verifyChain } = require('../lib/hashChain');
const { deriveMissingAdvisorGroups, deadlineForToday, createLateAlert } = require('../lib/lateAlert');
const { writeAdminAudit } = require('../lib/adminAudit');

const router = express.Router();
router.use(requireAuth(['admin']));

function withMissingAdvisorGroups(alert) {
  return {
    ...alert,
    missingAdvisorGroups: deriveMissingAdvisorGroups(alert.studentsAffected, alert.advisorsNotified),
  };
}

router.get('/notification-summary', async (_req, res) => {
  const [notificationGroups, activeAlerts, recentAlerts] = await Promise.all([
    prisma.notificationOutbox.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.lateAlert.count({ where: { status: 'ACTIVE' } }),
    prisma.lateAlert.findMany({
      orderBy: { triggeredAt: 'desc' },
      take: 100,
      select: {
        id: true,
        studentsAffected: true,
        advisorsNotified: true,
        trip: { select: { routeService: { select: { routeNo: true, name: true } } } },
      },
    }),
  ]);
  const notifications = Object.fromEntries(notificationGroups.map((row) => [row.status, row._count._all]));
  const missingAdvisorAlerts = recentAlerts
    .map((alert) => ({
      lateAlertId: alert.id,
      route: alert.trip.routeService,
      groups: deriveMissingAdvisorGroups(alert.studentsAffected, alert.advisorsNotified),
    }))
    .filter((alert) => alert.groups.length > 0);
  res.setHeader('Cache-Control', 'private, no-store');
  return res.json({
    activeAlerts,
    notifications: {
      pending: notifications.PENDING || 0,
      sent: notifications.SENT || 0,
      failed: notifications.FAILED || 0,
      total: notificationGroups.reduce((sum, row) => sum + row._count._all, 0),
    },
    missingAdvisorAlerts,
    missingAdvisorAlertCount: missingAdvisorAlerts.length,
  });
});

router.post('/notifications/retry-failed', async (req, res) => {
  const now = new Date();
  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.notificationOutbox.updateMany({
      where: { status: 'FAILED' },
      data: {
        status: 'PENDING',
        nextAttemptAt: now,
        lockedAt: null,
        lockToken: null,
      },
    });
    await writeAdminAudit(tx, req, {
      action: 'NOTIFICATION_BULK_RETRY_REQUESTED',
      entityType: 'NotificationOutbox',
      afterSummary: { queuedCount: updated.count },
    });
    return updated;
  });
  return res.status(202).json({ queued: result.count });
});

router.post('/notifications/:id/retry', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid notification ID' });
  const now = new Date();
  const result = await prisma.$transaction(async (tx) => {
    const notification = await tx.notificationOutbox.findUnique({
      where: { id },
      select: { id: true, status: true, attempts: true, lateAlertId: true },
    });
    if (!notification) return { error: 'Notification not found', statusCode: 404 };
    if (notification.status !== 'FAILED') {
      return { error: 'Only failed notifications can be manually retried', statusCode: 409 };
    }
    const updated = await tx.notificationOutbox.update({
      where: { id },
      data: {
        status: 'PENDING',
        nextAttemptAt: now,
        lockedAt: null,
        lockToken: null,
      },
      select: { id: true, status: true, attempts: true, nextAttemptAt: true, lateAlertId: true },
    });
    await writeAdminAudit(tx, req, {
      action: 'NOTIFICATION_RETRY_REQUESTED',
      entityType: 'NotificationOutbox',
      entityId: id,
      beforeSummary: { status: notification.status, attempts: notification.attempts, lateAlertId: notification.lateAlertId },
      afterSummary: { status: updated.status, attempts: updated.attempts, lateAlertId: updated.lateAlertId },
    });
    return { item: updated };
  });
  if (result.error) return res.status(result.statusCode).json({ error: result.error });
  return res.status(202).json(result.item);
});

router.get('/', async (req, res) => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const allowedNotificationStatuses = new Set(['PENDING', 'SENT', 'FAILED']);
  const notificationStatus = req.query.notificationStatus
    ? String(req.query.notificationStatus).trim().toUpperCase()
    : null;
  if (notificationStatus && !allowedNotificationStatuses.has(notificationStatus)) {
    return res.status(400).json({ error: 'notificationStatus must be PENDING, SENT, or FAILED' });
  }
  const alerts = await prisma.lateAlert.findMany({
    where: {
      triggeredAt: { gte: start },
      ...(notificationStatus ? { notifications: { some: { status: notificationStatus } } } : {}),
    },
    orderBy: { triggeredAt: 'desc' },
    include: {
      trip: {
        select: {
          id: true,
          collegeDeadlineAt: true,
          routeService: { select: { routeNo: true, name: true } },
          driver: { select: { name: true } },
        },
      },
      notifications: {
        select: {
          id: true,
          recipient: true,
          status: true,
          attempts: true,
          nextAttemptAt: true,
          lastAttemptAt: true,
          lastError: true,
          sentAt: true,
          providerMessageId: true,
        },
      },
    },
  });
  res.setHeader('Cache-Control', 'private, no-store');
  return res.json(alerts.map(withMissingAdvisorGroups));
});

router.get('/deadline', async (_req, res) => {
  const deadline = process.env.COLLEGE_ARRIVAL_DEADLINE || '09:45';
  const [h, m] = deadline.split(':').map(Number);
  const hour12 = ((h + 11) % 12) + 1;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const formatted = `${hour12}:${String(m).padStart(2, '0')} ${ampm}`;
  return res.json({
    deadline,
    formatted,
    timeZone: process.env.APP_TIMEZONE || 'Asia/Kolkata',
    deadlineTodayIso: deadlineForToday().toISOString(),
  });
});

router.patch('/deadline', async (req, res) => {
  const { deadline } = req.body || {};
  if (!deadline || !/^\d{2}:\d{2}$/.test(String(deadline).trim())) {
    return res.status(400).json({ error: 'Deadline must be in HH:MM format (e.g. 09:45)' });
  }
  const clean = String(deadline).trim();
  const prev = process.env.COLLEGE_ARRIVAL_DEADLINE || '09:45';
  process.env.COLLEGE_ARRIVAL_DEADLINE = clean;

  await writeAdminAudit(prisma, req, {
    action: 'COLLEGE_ARRIVAL_DEADLINE_UPDATED',
    entityType: 'SystemConfig',
    entityId: 'COLLEGE_ARRIVAL_DEADLINE',
    beforeSummary: { deadline: prev },
    afterSummary: { deadline: clean },
  });

  const [h, m] = clean.split(':').map(Number);
  const hour12 = ((h + 11) % 12) + 1;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const formatted = `${hour12}:${String(m).padStart(2, '0')} ${ampm}`;
  return res.json({
    success: true,
    deadline: clean,
    formatted,
  });
});

router.post('/check', async (_req, res) => {
  const deadline = deadlineForToday();
  const runningTrips = await prisma.trip.findMany({
    where: { status: 'RUNNING' },
    select: {
      id: true,
      currentEta: true,
      collegeDeadlineAt: true,
      routeService: { select: { routeNo: true, name: true } },
    },
  });

  const triggered = [];
  for (const trip of runningTrips) {
    const finalStop = Array.isArray(trip.currentEta?.stops)
      ? trip.currentEta.stops[trip.currentEta.stops.length - 1]
      : null;
    if (finalStop?.etaMinutes != null) {
      const predictedEta = new Date(Date.now() + finalStop.etaMinutes * 60 * 1000);
      if (predictedEta > deadline) {
        const created = await createLateAlert(trip.id, predictedEta);
        if (created) triggered.push(created);
      }
    }
  }

  return res.json({
    evaluatedTrips: runningTrips.length,
    triggered,
  });
});

router.get('/verify', async (_req, res) => {
  const rows = await prisma.lateAlert.findMany({ orderBy: { id: 'asc' } });
  return res.json(verifyChain(rows));
});

module.exports = router;
module.exports.withMissingAdvisorGroups = withMissingAdvisorGroups;
