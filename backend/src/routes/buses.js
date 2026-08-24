const express = require('express');
const prisma = require('../lib/prisma');
const { crudRouter } = require('../crud');
const { busSchema } = require('../schemas');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /buses/by-driver/:driverId — the driver's assigned bus (driver-facing).
// Returns null bus if the driver has no assignment yet.
router.get('/by-driver/:driverId', requireAuth(['driver', 'admin']), async (req, res) => {
  try {
    const driverId = Number(req.params.driverId);
    if (Number.isNaN(driverId)) return res.status(400).json({ error: 'Invalid driverId' });
    const bus = await prisma.bus.findFirst({
      where: { driverId },
      include: { route: true, driver: { select: { id: true, name: true, phone: true } } },
    });
    if (!bus) {
      return res.status(404).json({ error: 'No bus assigned to this driver' });
    }
    res.json(bus);
  } catch (err) {
    console.error('bus by driver error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const busCrud = crudRouter({
  delegate: prisma.bus,
  createSchema: busSchema,
  updateSchema: busSchema.partial(),
  include: { route: true, driver: { select: { id: true, name: true, phone: true } } },
});
router.use('/', busCrud);

module.exports = router;