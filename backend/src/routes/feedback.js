const crypto = require('crypto');
const express = require('express');
const { rateLimit } = require('express-rate-limit');
const { z } = require('zod');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');
const { createLimiterStore } = require('../middleware/security');
const { writeAdminAudit } = require('../lib/adminAudit');

const router = express.Router();
const categories = ['DRIVER_BEHAVIOUR', 'DRIVING', 'BUS_CONDITION', 'ROUTE_STOP_ISSUE', 'SCHEDULE_ISSUE', 'APP_ISSUE', 'OTHER'];
const statuses = ['NEW', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED'];
const feedbackSchema = z.object({
  category: z.enum(categories),
  routeServiceId: z.number().int().positive().nullable().optional(),
  tripId: z.number().int().positive().nullable().optional(),
  description: z.string().trim().min(10).max(2000),
  additionalInfo: z.string().trim().max(1000).nullable().optional(),
});
const limiterStore = createLimiterStore('feedback');
const feedbackLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many feedback submissions. Try again later.' },
  passOnStoreError: false,
  ...(limiterStore ? { store: limiterStore } : {}),
});

function feedbackFingerprint(input, requestIdentity, secret = process.env.JWT_SECRET || 'development-only') {
  const normalized = JSON.stringify({
    category: input.category,
    routeServiceId: input.routeServiceId || null,
    tripId: input.tripId || null,
    description: input.description.trim().toLowerCase().replace(/\s+/g, ' '),
    requestIdentity,
  });
  return crypto.createHmac('sha256', secret).update(normalized, 'utf8').digest('hex');
}

router.post('/', feedbackLimiter, async (req, res) => {
  const parsed = feedbackSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid feedback payload', details: parsed.error.flatten() });
  const input = parsed.data;
  const fingerprintHash = feedbackFingerprint(input, `${req.ip || ''}|${req.get('user-agent') || ''}`);
  try {
    if (input.tripId) {
      const trip = await prisma.trip.findUnique({ where: { id: input.tripId }, select: { routeServiceId: true } });
      if (!trip) return res.status(400).json({ error: 'Trip not found' });
      if (input.routeServiceId && input.routeServiceId !== trip.routeServiceId) {
        return res.status(400).json({ error: 'Trip does not belong to the selected route' });
      }
      input.routeServiceId = trip.routeServiceId;
    }
    const duplicate = await prisma.feedbackReport.findFirst({
      where: { fingerprintHash, createdAt: { gte: new Date(Date.now() - 15 * 60 * 1000) } },
      select: { id: true, status: true, createdAt: true },
    });
    if (duplicate) return res.status(202).json({ feedback: duplicate, duplicate: true });
    const created = await prisma.feedbackReport.create({
      data: { ...input, fingerprintHash },
      select: { id: true, category: true, routeServiceId: true, tripId: true, status: true, createdAt: true },
    });
    return res.status(201).json({ feedback: created, duplicate: false });
  } catch (error) {
    console.error('[feedback/create]', error);
    return res.status(500).json({ error: 'Feedback could not be submitted' });
  }
});

router.use(requireAuth(['admin']));
router.use((_req, res, next) => { res.setHeader('Cache-Control', 'private, no-store'); next(); });

router.get('/', async (req, res) => {
  const status = req.query.status ? String(req.query.status).toUpperCase() : null;
  if (status && !statuses.includes(status)) return res.status(400).json({ error: 'Invalid feedback status' });
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
  const where = status ? { status } : {};
  const [items, total] = await Promise.all([
    prisma.feedbackReport.findMany({
      where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' },
      select: {
        id: true, category: true, routeServiceId: true, tripId: true, description: true,
        additionalInfo: true, status: true, createdAt: true, updatedAt: true, resolvedAt: true,
      },
    }),
    prisma.feedbackReport.count({ where }),
  ]);
  return res.json({ items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
});

router.patch('/:id/status', async (req, res) => {
  const status = String(req.body?.status || '').toUpperCase();
  if (!statuses.includes(status)) return res.status(400).json({ error: 'Invalid feedback status' });
  try {
    const updated = await prisma.$transaction(async (tx) => {
      const before = await tx.feedbackReport.findUnique({ where: { id: String(req.params.id) } });
      if (!before) return null;
      const item = await tx.feedbackReport.update({
        where: { id: before.id },
        data: { status, resolvedAt: ['RESOLVED', 'DISMISSED'].includes(status) ? new Date() : null },
        select: { id: true, category: true, routeServiceId: true, tripId: true, status: true, resolvedAt: true, updatedAt: true },
      });
      await writeAdminAudit(tx, req, {
        action: 'FEEDBACK_STATUS_CHANGED', entityType: 'FeedbackReport', entityId: item.id,
        beforeSummary: { status: before.status, category: before.category },
        afterSummary: { status: item.status, category: item.category },
      });
      return item;
    });
    if (!updated) return res.status(404).json({ error: 'Feedback not found' });
    return res.json(updated);
  } catch (error) {
    console.error('[feedback/status]', error);
    return res.status(500).json({ error: 'Feedback status could not be changed' });
  }
});

module.exports = router;
module.exports.feedbackFingerprint = feedbackFingerprint;
