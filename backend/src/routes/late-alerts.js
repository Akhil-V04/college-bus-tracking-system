const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');
const { verifyChain } = require('../lib/hashChain');

const router = express.Router();
router.use(requireAuth(['admin']));

router.get('/', async (_req, res) => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const alerts = await prisma.lateAlert.findMany({
    where: { triggeredAt: { gte: start } },
    orderBy: { triggeredAt: 'desc' },
    include: {
      trip: {
        select: {
          id: true,
          routeService: { select: { routeNo: true, name: true } },
          driver: { select: { name: true } },
        },
      },
      notifications: {
        select: { id: true, recipient: true, status: true, attempts: true, lastError: true, sentAt: true },
      },
    },
  });
  return res.json(alerts);
});

router.get('/verify', async (_req, res) => {
  const rows = await prisma.lateAlert.findMany({ orderBy: { id: 'asc' } });
  return res.json(verifyChain(rows));
});

module.exports = router;
