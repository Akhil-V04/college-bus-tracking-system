const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

/**
 * Helper to enrich notifications with route numbers and formatted labels
 */
async function enrichNotifications(notifications) {
  if (!Array.isArray(notifications) || notifications.length === 0) return [];

  const routeIds = [
    ...new Set(
      notifications.flatMap((n) => (n.targetRoutes || []).map((tr) => tr.routeServiceId))
    ),
  ];

  let routeMap = new Map();
  if (routeIds.length > 0) {
    const routeServices = await prisma.routeService.findMany({
      where: { id: { in: routeIds } },
      select: { id: true, routeNo: true, name: true },
    });
    routeMap = new Map(routeServices.map((r) => [r.id, r]));
  }

  return notifications.map((n) => {
    const routes = (n.targetRoutes || [])
      .map((tr) => routeMap.get(tr.routeServiceId))
      .filter(Boolean);

    // Sort route numbers naturally (e.g. 1, 2, 5, 10)
    const targetRouteNos = routes
      .map((r) => r.routeNo)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    const routesFormatted =
      n.targetType === 'ROUTE'
        ? targetRouteNos.length > 0
          ? targetRouteNos.map((no) => `Route ${no}`).join(', ')
          : 'Specific Routes'
        : 'All Routes (Campus-Wide)';

    return {
      ...n,
      routes,
      targetRouteNos,
      routesFormatted,
    };
  });
}

/**
 * GET /api/v1/admin-notifications
 * Passengers and Drivers can fetch active notifications without auth.
 * Admins can fetch all notifications.
 */
router.get('/', async (req, res) => {
  try {
    const isAdmin = req.headers.authorization || req.headers.cookie ? true : false;

    // For passengers, only fetch active and unexpired
    const whereClause = isAdmin
      ? {}
      : {
          status: 'ACTIVE',
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        };

    const notifications = await prisma.adminNotification.findMany({
      where: whereClause,
      orderBy: { publishedAt: 'desc' },
      include: {
        targetRoutes: { select: { routeServiceId: true } },
      },
    });

    const enriched = await enrichNotifications(notifications);
    res.json(enriched);
  } catch (error) {
    console.error('Failed to fetch notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

/**
 * POST /api/v1/admin-notifications
 * Admin only: Create a new broadcast notification
 */
router.post('/', requireAuth(['admin']), async (req, res) => {
  try {
    const { title, message, priority, targetType, targetRoutes, expiresAt } = req.body;

    if (!title || !message) {
      return res.status(400).json({ error: 'Title and message are required' });
    }

    const notification = await prisma.adminNotification.create({
      data: {
        title,
        message,
        priority: priority || 'NORMAL',
        targetType: targetType || 'GLOBAL',
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        createdByAdminId: req.user.id,
        targetRoutes:
          targetType === 'ROUTE' && targetRoutes && targetRoutes.length > 0
            ? {
                create: targetRoutes.map((routeId) => ({ routeServiceId: routeId })),
              }
            : undefined,
      },
      include: {
        targetRoutes: { select: { routeServiceId: true } },
      },
    });

    const [enriched] = await enrichNotifications([notification]);

    // Broadcast via Socket.IO
    const io = req.app.get('io');
    if (io) {
      const socketPayload = {
        id: enriched.id,
        title: enriched.title,
        message: enriched.message,
        priority: enriched.priority,
        targetType: enriched.targetType,
        targetRouteNos: enriched.targetRouteNos || [],
        routesFormatted: enriched.routesFormatted,
        publishedAt: enriched.publishedAt,
      };

      // Emit globally so all public mobile app passengers receive it with the target routes!
      io.emit('broadcast:notification', socketPayload);

      // Also emit to specific route rooms if any route-specific listeners exist
      if (enriched.targetType === 'ROUTE' && Array.isArray(notification.targetRoutes)) {
        notification.targetRoutes.forEach((r) => {
          io.to(`route:${r.routeServiceId}`).emit('broadcast:notification', socketPayload);
        });
      }
    }

    res.status(201).json(enriched);
  } catch (error) {
    console.error('Failed to create notification:', error);
    res.status(500).json({ error: 'Failed to create notification' });
  }
});

/**
 * DELETE /api/v1/admin-notifications/:id
 * Admin only: Delete a broadcast notification
 */
router.delete('/:id', requireAuth(['admin']), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id || isNaN(id)) {
      return res.status(400).json({ error: 'Invalid notification ID' });
    }

    await prisma.adminNotificationRoute.deleteMany({
      where: { notificationId: id },
    });

    await prisma.adminNotification.delete({
      where: { id },
    });

    res.json({ success: true, message: 'Notification removed successfully' });
  } catch (error) {
    console.error('Failed to delete notification:', error);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

module.exports = router;
