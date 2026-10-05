const crypto = require('crypto');
const bcrypt = require('bcrypt');
const express = require('express');
const { rateLimit } = require('express-rate-limit');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');
const { createLimiterStore } = require('../middleware/security');

const router = express.Router();
const allowedThresholds = new Set([1, 5, 10]);
const pushLimiterStore = createLimiterStore('push-subscription');
const pushLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many push-subscription requests. Try again later.' },
  passOnStoreError: false,
  ...(pushLimiterStore ? { store: pushLimiterStore } : {}),
});

function tokenHash(token) {
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
}

function normalizePushToken(value) {
  const token = String(value || '').trim();
  if (token.length < 20 || token.length > 4096 || /\s/.test(token)) return null;
  return token;
}

async function createSubscription(res, body, driverId = null) {
  const pushToken = normalizePushToken(body?.pushToken);
  const platform = String(body?.platform || 'ANDROID').toUpperCase();
  if (!pushToken || !['ANDROID', 'IOS'].includes(platform)) {
    return res.status(400).json({ error: 'A valid pushToken and platform are required' });
  }
  const managementSecret = crypto.randomBytes(32).toString('base64url');
  try {
    const item = await prisma.pushDeviceSubscription.create({
      data: {
        pushToken,
        tokenHash: tokenHash(pushToken),
        managementSecretHash: await bcrypt.hash(managementSecret, 10),
        platform,
        driverId,
        expiresAt: new Date(Date.now() + 365 * 86_400_000),
      },
      select: { id: true, platform: true, driverId: true, active: true, expiresAt: true, createdAt: true },
    });
    res.setHeader('Cache-Control', 'private, no-store');
    return res.status(201).json({ subscription: item, managementSecret });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'This device token is already registered; use its management secret' });
    }
    console.error('[push-subscriptions/create]', error);
    return res.status(500).json({ error: 'Push subscription could not be created' });
  }
}

async function authorizeManagement(req, res, next) {
  const id = String(req.params.id || '');
  const secret = req.get('x-subscription-secret') || '';
  const item = await prisma.pushDeviceSubscription.findUnique({ where: { id } });
  if (!item || !secret || !(await bcrypt.compare(secret, item.managementSecretHash))) {
    return res.status(404).json({ error: 'Subscription not found' });
  }
  req.pushSubscription = item;
  return next();
}

router.post('/anonymous', pushLimiter, (req, res) => createSubscription(res, req.body));
router.post('/driver', pushLimiter, requireAuth(['driver']), (req, res) => {
  return createSubscription(res, req.body, Number(req.user.id));
});

router.post('/:id/stop-alerts', pushLimiter, authorizeManagement, async (req, res) => {
  const routeServiceId = Number(req.body?.routeServiceId);
  const stopId = Number(req.body?.stopId);
  const thresholdsMinutes = [...new Set(req.body?.thresholdsMinutes || [])].sort((a, b) => b - a);
  if (!Number.isInteger(routeServiceId) || !Number.isInteger(stopId) ||
      !thresholdsMinutes.length || thresholdsMinutes.some((value) => !allowedThresholds.has(value))) {
    return res.status(400).json({ error: 'Valid routeServiceId, stopId, and thresholdsMinutes from [10,5,1] are required' });
  }
  const applicable = await prisma.scheduleStop.findFirst({
    where: { stopId, scheduleVersion: { routeServiceId, status: 'PUBLISHED' } },
    select: { id: true },
  });
  if (!applicable) return res.status(400).json({ error: 'The stop is not on the published route' });
  const item = await prisma.stopAlertSubscription.upsert({
    where: {
      pushDeviceSubscriptionId_routeServiceId_stopId: {
        pushDeviceSubscriptionId: req.pushSubscription.id,
        routeServiceId,
        stopId,
      },
    },
    update: { thresholdsMinutes, active: true },
    create: {
      pushDeviceSubscriptionId: req.pushSubscription.id,
      routeServiceId,
      stopId,
      thresholdsMinutes,
    },
    select: { id: true, routeServiceId: true, stopId: true, thresholdsMinutes: true, active: true },
  });
  await prisma.pushDeviceSubscription.update({
    where: { id: req.pushSubscription.id },
    data: { active: true, lastSeenAt: new Date(), expiresAt: new Date(Date.now() + 365 * 86_400_000) },
  });
  return res.json(item);
});

router.delete('/:id/stop-alerts/:alertId', pushLimiter, authorizeManagement, async (req, res) => {
  const changed = await prisma.stopAlertSubscription.updateMany({
    where: { id: String(req.params.alertId), pushDeviceSubscriptionId: req.pushSubscription.id },
    data: { active: false },
  });
  if (!changed.count) return res.status(404).json({ error: 'Stop alert not found' });
  return res.json({ unsubscribed: true });
});

router.delete('/:id', pushLimiter, authorizeManagement, async (req, res) => {
  await prisma.$transaction([
    prisma.stopAlertSubscription.updateMany({
      where: { pushDeviceSubscriptionId: req.pushSubscription.id }, data: { active: false },
    }),
    prisma.pushDeviceSubscription.update({
      where: { id: req.pushSubscription.id }, data: { active: false },
    }),
  ]);
  return res.json({ unsubscribed: true });
});

module.exports = router;
module.exports.normalizePushToken = normalizePushToken;
module.exports.tokenHash = tokenHash;
