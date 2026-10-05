const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

/**
 * GET /api/v1/admin-notifications
 * Passengers and Drivers can fetch active notifications without auth.
 * Admins can fetch all notifications.
 */
router.get('/', async (req, res) => {
  try {
    const isAdmin = req.headers.authorization || req.headers.cookie ? true : false; 
    // Basic check; actual role check would verify token
    
    // For passengers, only fetch active and unexpired
    const whereClause = isAdmin ? {} : {
      status: 'ACTIVE',
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } }
      ]
    };

    const notifications = await prisma.adminNotification.findMany({
      where: whereClause,
      orderBy: { publishedAt: 'desc' },
      include: {
        targetRoutes: { select: { routeServiceId: true } }
      }
    });
    
    res.json(notifications);
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
        targetRoutes: targetType === 'ROUTE' && targetRoutes && targetRoutes.length > 0
          ? {
              create: targetRoutes.map(routeId => ({ routeServiceId: routeId }))
            }
          : undefined
      },
      include: {
        targetRoutes: { select: { routeServiceId: true } }
      }
    });

    // Broadcast via Socket.IO
    const io = req.app.get('io');
    if (io) {
      const payload = {
        id: notification.id,
        title: notification.title,
        message: notification.message,
        priority: notification.priority,
        publishedAt: notification.publishedAt
      };
      
      if (notification.targetType === 'GLOBAL') {
        io.emit('broadcast:notification', payload);
      } else {
        // Emit to specific route rooms
        notification.targetRoutes.forEach(r => {
          io.to(`route:${r.routeServiceId}`).emit('broadcast:notification', payload);
        });
      }
    }

    res.status(201).json(notification);
  } catch (error) {
    console.error('Failed to create notification:', error);
    res.status(500).json({ error: 'Failed to create notification' });
  }
});

module.exports = router;
