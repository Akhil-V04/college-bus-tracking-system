const express = require('express');
const bcrypt = require('bcrypt');
const prisma = require('../lib/prisma');
const { signToken, requireAuth } = require('../middleware/auth');

const router = express.Router();

router.post('/login', async (req, res) => {
  try {
    const { role, identifier, password } = req.body || {};
    if (!['admin', 'driver'].includes(role) || !identifier || !password) {
      return res.status(400).json({ error: 'role, identifier and password are required' });
    }

    if (role === 'admin') {
      if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD_HASH) {
        return res.status(500).json({ error: 'Admin credentials are not configured' });
      }
      const valid =
        identifier === process.env.ADMIN_EMAIL &&
        (await bcrypt.compare(password, process.env.ADMIN_PASSWORD_HASH));
      if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

      return res.json({
        token: signToken({ role: 'admin', id: 'admin' }),
        role: 'admin',
        id: 'admin',
      });
    }

    const driver = await prisma.driver.findUnique({ where: { driverCode: identifier } });
    const valid = driver && (await bcrypt.compare(password, driver.passwordHash));
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    return res.json({
      token: signToken({
        role: 'driver',
        id: driver.id,
        sessionVersion: driver.sessionVersion,
      }),
      role: 'driver',
      id: driver.id,
      name: driver.name,
    });
  } catch (error) {
    console.error('[auth/login]', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/me', requireAuth(['admin', 'driver']), async (req, res) => {
  if (req.user.role === 'admin') return res.json({ role: 'admin', id: 'admin' });

  const driver = await prisma.driver.findUnique({
    where: { id: Number(req.user.id) },
    select: {
      id: true,
      driverCode: true,
      name: true,
      sessionVersion: true,
      assignedRoute: {
        select: { id: true, routeNo: true, name: true, areaCovered: true, capacity: true },
      },
    },
  });
  if (!driver || driver.sessionVersion !== req.user.sessionVersion) {
    return res.status(401).json({ error: 'Driver session has been revoked' });
  }
  return res.json({ role: 'driver', ...driver });
});

router.post('/seed-passwords', async (req, res) => {
  if (process.env.NODE_ENV !== 'development') return res.status(404).json({ error: 'Not found' });
  if (!req.body?.password) return res.status(400).json({ error: 'password is required' });
  return res.json({ hash: await bcrypt.hash(req.body.password, 10) });
});

module.exports = router;
