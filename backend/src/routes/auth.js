const express = require('express');
const bcrypt = require('bcrypt');
const prisma = require('../lib/prisma');
const { AUTH_POLICY, signToken, requireAuth } = require('../middleware/auth');
const {
  adminSessionExpiry,
  pruneAdminSessions,
  revokeAdminSession,
  revokeAllAdminSessions,
} = require('../lib/adminSessions');
const { writeAdminAudit } = require('../lib/adminAudit');
const { createRateLimiters } = require('../middleware/security');
const { clearAdminCookie, serializeAdminCookie } = require('../lib/adminCookie');

const router = express.Router();
const { login: loginRateLimiter } = createRateLimiters();
const ADMIN_IDENTIFIER = 'admin';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function privateResponse(res) {
  res.setHeader('Cache-Control', 'private, no-store');
  return res;
}

function sessionStatus(session, now = new Date()) {
  if (session.revokedAt) return 'REVOKED';
  if (session.expiresAt <= now) return 'EXPIRED';
  return 'ACTIVE';
}

router.use((_req, res, next) => {
  privateResponse(res);
  next();
});

router.post('/login', loginRateLimiter, async (req, res) => {
  try {
    const { role, identifier, password } = req.body || {};
    if (!['admin', 'driver'].includes(role) || !identifier || !password) {
      return res.status(400).json({ error: 'role, identifier and password are required' });
    }

    if (role === 'admin') {
      if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD_HASH) {
        return res.status(500).json({ error: 'Admin credentials are not configured' });
      }
      const normalizedIdentifier = String(identifier).trim().toLowerCase();
      const normalizedAdminEmail = process.env.ADMIN_EMAIL.trim().toLowerCase();
      const valid =
        normalizedIdentifier === normalizedAdminEmail &&
        (await bcrypt.compare(password, process.env.ADMIN_PASSWORD_HASH));
      if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

      const now = new Date();
      const expiresAt = adminSessionExpiry(now, AUTH_POLICY.adminSessionMinutes);
      const session = await prisma.$transaction(async (tx) => {
        await pruneAdminSessions(tx, now);
        const created = await tx.adminSession.create({
          data: { adminIdentifier: ADMIN_IDENTIFIER, expiresAt },
        });
        await writeAdminAudit(tx, { user: { id: ADMIN_IDENTIFIER } }, {
          action: 'ADMIN_SESSION_CREATED',
          entityType: 'AdminSession',
          entityId: created.id,
          afterSummary: { expiresAt: created.expiresAt },
        });
        return created;
      });

      const token = signToken(
        { role: 'admin', id: ADMIN_IDENTIFIER, sessionId: session.id },
        { expiresInMinutes: AUTH_POLICY.adminSessionMinutes }
      );
      res.setHeader('Set-Cookie', serializeAdminCookie(token, AUTH_POLICY.adminSessionMinutes * 60));
      return privateResponse(res).json({
        role: 'admin',
        id: ADMIN_IDENTIFIER,
        expiresAt: session.expiresAt,
      });
    }

    const driver = await prisma.driver.findUnique({ where: { driverCode: String(identifier).trim() } });
    const valid = driver && (await bcrypt.compare(password, driver.passwordHash));
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const expiresAt = adminSessionExpiry(new Date(), AUTH_POLICY.driverTokenMinutes);
    return privateResponse(res).json({
      token: signToken({
        role: 'driver',
        id: driver.id,
        sessionVersion: driver.sessionVersion,
      }),
      role: 'driver',
      id: driver.id,
      name: driver.name,
      expiresAt,
    });
  } catch (error) {
    console.error('[auth/login]', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/me', requireAuth(['admin', 'driver']), async (req, res) => {
  if (req.user.role === 'admin') {
    return privateResponse(res).json({
      role: 'admin',
      id: String(req.user.id),
      session: {
        id: req.adminSession.id,
        createdAt: req.adminSession.createdAt,
        expiresAt: req.adminSession.expiresAt,
      },
    });
  }

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
  return privateResponse(res).json({ role: 'driver', ...driver });
});

router.post('/logout', requireAuth(['admin']), async (req, res) => {
  try {
    const result = await prisma.$transaction(async (tx) => {
      const revoked = await revokeAdminSession(tx, req.user.sessionId, 'LOGOUT');
      if (revoked.count) {
        await writeAdminAudit(tx, req, {
          action: 'ADMIN_SESSION_LOGOUT',
          entityType: 'AdminSession',
          entityId: req.user.sessionId,
          afterSummary: { revoked: true },
        });
      }
      return revoked;
    });
    res.setHeader('Set-Cookie', clearAdminCookie());
    return privateResponse(res).json({ revoked: result.count === 1 });
  } catch (error) {
    console.error('[auth/logout]', error);
    return res.status(500).json({ error: 'Administrator session could not be revoked' });
  }
});

router.get('/admin/sessions', requireAuth(['admin']), async (req, res) => {
  try {
    const sessions = await prisma.adminSession.findMany({
      where: { adminIdentifier: String(req.user.id) },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    const now = new Date();
    return privateResponse(res).json(sessions.map((session) => ({
      id: session.id,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
      revokedAt: session.revokedAt,
      revokeReason: session.revokeReason,
      current: session.id === req.user.sessionId,
      status: sessionStatus(session, now),
    })));
  } catch (error) {
    console.error('[auth/session-list]', error);
    return res.status(500).json({ error: 'Administrator sessions could not be loaded' });
  }
});

router.post('/admin/sessions/revoke-all', requireAuth(['admin']), async (req, res) => {
  try {
    const revoked = await prisma.$transaction(async (tx) => {
      const result = await revokeAllAdminSessions(tx, req.user.id, 'ADMIN_REVOKE_ALL');
      await writeAdminAudit(tx, req, {
        action: 'ADMIN_SESSIONS_REVOKED',
        entityType: 'AdminSession',
        entityId: 'all',
        afterSummary: { revokedSessions: result.count },
      });
      return result;
    });
    res.setHeader('Set-Cookie', clearAdminCookie());
    return privateResponse(res).json({ revoked: true, revokedSessions: revoked.count });
  } catch (error) {
    console.error('[auth/session-revoke-all]', error);
    return res.status(500).json({ error: 'Administrator sessions could not be revoked' });
  }
});

router.post('/admin/sessions/:id/revoke', requireAuth(['admin']), async (req, res) => {
  const sessionId = String(req.params.id || '');
  if (!UUID_PATTERN.test(sessionId)) return res.status(400).json({ error: 'Invalid administrator session ID' });

  try {
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.adminSession.findFirst({
        where: { id: sessionId, adminIdentifier: String(req.user.id) },
      });
      if (!existing) return { statusCode: 404 };
      if (existing.revokedAt) return { statusCode: 409 };
      const revoked = await revokeAdminSession(tx, sessionId, 'ADMIN_REVOKE_ONE');
      await writeAdminAudit(tx, req, {
        action: 'ADMIN_SESSION_REVOKED',
        entityType: 'AdminSession',
        entityId: sessionId,
        afterSummary: { revoked: revoked.count === 1, currentSession: sessionId === req.user.sessionId },
      });
      return { statusCode: 200, revoked: revoked.count === 1 };
    });
    if (result.statusCode === 404) return res.status(404).json({ error: 'Administrator session not found' });
    if (result.statusCode === 409) return res.status(409).json({ error: 'Administrator session is already revoked' });
    if (sessionId === req.user.sessionId) res.setHeader('Set-Cookie', clearAdminCookie());
    return privateResponse(res).json({ revoked: result.revoked, currentSession: sessionId === req.user.sessionId });
  } catch (error) {
    console.error('[auth/session-revoke]', error);
    return res.status(500).json({ error: 'Administrator session could not be revoked' });
  }
});

module.exports = router;
module.exports.ADMIN_IDENTIFIER = ADMIN_IDENTIFIER;
module.exports.sessionStatus = sessionStatus;