const express = require('express');
const prisma = require('../lib/prisma');
const { crudRouter } = require('../crud');
const { routeStopSchema } = require('../schemas');

const router = express.Router();

// GET /route-stops/:routeId — public, ordered stops for a route with scheduledTime
router.get('/:routeId', async (req, res) => {
  try {
    const routeId = parseInt(req.params.routeId, 10);
    if (Number.isNaN(routeId)) return res.status(400).json({ error: 'Invalid routeId' });
    const routeStops = await prisma.routeStop.findMany({
      where: { routeId },
      orderBy: { sequenceOrder: 'asc' },
      include: { stop: true },
    });
    res.json(routeStops);
  } catch (err) {
    console.error('route-stops by route error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin CRUD for route-stops (create/update/delete). GET list here is admin-only
// and paginated; the public order-by-route endpoint above is the one the app uses.
const routeStopCrud = crudRouter({
  delegate: prisma.routeStop,
  createSchema: routeStopSchema,
  updateSchema: routeStopSchema.partial(),
});

router.use('/', routeStopCrud);

module.exports = router;