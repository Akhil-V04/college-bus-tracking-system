const express = require('express');
const bcrypt = require('bcrypt');
const { OAuth2Client } = require('google-auth-library');
const prisma = require('../lib/prisma');
const { signToken } = require('../middleware/auth');

const router = express.Router();

const VALID_PASSWORD_ROLES = ['admin', 'driver'];
const VALID_GOOGLE_ROLES = ['student', 'classAdvisor'];

const oauthClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// POST /auth/login — password auth for admin + driver
// body: { role, identifier, password }
router.post('/login', async (req, res) => {
  try {
    const { role, identifier, password } = req.body || {};

    if (!role || !identifier || !password) {
      return res.status(400).json({ error: 'role, identifier and password are required' });
    }

    if (!VALID_PASSWORD_ROLES.includes(role)) {
      return res
        .status(400)
        .json({ error: `role must be one of: ${VALID_PASSWORD_ROLES.join(', ')}` });
    }

    if (role === 'admin') {
      const adminEmail = process.env.ADMIN_EMAIL;
      const adminHash = process.env.ADMIN_PASSWORD_HASH;
      if (!adminEmail || !adminHash) {
        return res.status(500).json({ error: 'Admin credentials not configured on the server' });
      }
      if (identifier !== adminEmail) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      const ok = await bcrypt.compare(password, adminHash);
      if (!ok) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      const token = signToken({ role: 'admin', id: 'admin' });
      return res.json({ token, role: 'admin', id: 'admin' });
    }

    // role === 'driver'
    const driver = await prisma.driver.findUnique({ where: { phone: identifier } });
    if (!driver) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const ok = await bcrypt.compare(password, driver.passwordHash);
    if (!ok) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = signToken({ role: 'driver', id: driver.id });
    return res.json({ token, role: 'driver', id: driver.id, name: driver.name });
  } catch (err) {
    console.error('[auth/login]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /auth/seed-passwords — dev-only. Returns the bcrypt hash of a plain password.
// body: { password }
router.post('/seed-passwords', (req, res) => {
  if (process.env.NODE_ENV !== 'development') {
    return res.status(404).json({ error: 'Not found' });
  }
  const { password } = req.body || {};
  if (!password) {
    return res.status(400).json({ error: 'password is required' });
  }
  bcrypt.hash(password, 10, (err, hash) => {
    if (err) return res.status(500).json({ error: 'Failed to hash password' });
    return res.json({ hash });
  });
});

// POST /auth/google — Google OAuth for student + classAdvisor
// body: { role, idToken }
router.post('/google', async (req, res) => {
  try {
    const { role, idToken } = req.body || {};

    if (!role || !idToken) {
      return res.status(400).json({ error: 'role and idToken are required' });
    }
    if (!VALID_GOOGLE_ROLES.includes(role)) {
      return res
        .status(400)
        .json({ error: `role must be one of: ${VALID_GOOGLE_ROLES.join(', ')}` });
    }

    let payload;
    try {
      const ticket = await oauthClient.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } catch (err) {
      return res.status(401).json({ error: 'Invalid Google id token' });
    }

    const email = payload.email;

    let user = null;
    if (role === 'student') {
      user = await prisma.student.findUnique({ where: { email } });
    } else {
      user = await prisma.classAdvisor.findUnique({ where: { email } });
    }

    if (!user) {
      return res.status(404).json({
        error: 'No student/advisor record found for this email — ask admin to add you first',
      });
    }

    const googleId = payload.sub;

    if (!user.googleId) {
      // First login — store the Google account id
      if (role === 'student') {
        user = await prisma.student.update({
          where: { id: user.id },
          data: { googleId },
        });
      } else {
        user = await prisma.classAdvisor.update({
          where: { id: user.id },
          data: { googleId },
        });
      }
    } else if (user.googleId !== googleId) {
      // Extra safety check: a college email must always match the same Google account
      return res.status(403).json({ error: 'Google account does not match the registered email' });
    }

    const token = signToken({ role, id: user.id });
    return res.json({ token, role, id: user.id, name: user.name });
  } catch (err) {
    console.error('[auth/google]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
