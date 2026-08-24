const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');
const { checkAllTrips } = require('../lib/lateAlert');
const { verifyChain } = require('../lib/hashChain');

const router = express.Router();

// POST /late-alerts/check — admin: evaluate every RUNNING trip and trigger an
// alert for any bus that is running late.
router.post('/check', requireAuth(['admin']), async (req, res) => {
  try {
    const triggered = await checkAllTrips();
    res.json({ checked: true, triggered });
  } catch (err) {
    console.error('[late-alerts/check]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /late-alerts — admin: today's late alerts with trip/bus/route context,
// most recent first.
router.get('/', requireAuth(['admin']), async (req, res) => {
  try {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const alerts = await prisma.lateAlert.findMany({
      where: { triggeredAt: { gte: start } },
      orderBy: { triggeredAt: 'desc' },
      include: {
        trip: {
          include: {
            bus: {
              include: {
                route: true,
                driver: { select: { id: true, name: true, phone: true } },
              },
            },
          },
        },
      },
    });
    res.json(alerts);
  } catch (err) {
    console.error('[late-alerts list]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /late-alerts/verify — admin: recompute the SHA-256 hash chain and report
// whether any alert has been tampered with.
router.get('/verify', requireAuth(['admin']), async (req, res) => {
  try {
    const rows = await prisma.lateAlert.findMany({ orderBy: { id: 'asc' } });
    res.json(verifyChain(rows));
  } catch (err) {
    console.error('[late-alerts/verify]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
