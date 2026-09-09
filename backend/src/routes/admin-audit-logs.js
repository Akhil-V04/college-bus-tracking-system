const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');
const { parsePagination } = require('../crud');

const router = express.Router();

function optionalFilter(value, maxLength = 100) {
  if (value === undefined) return undefined;
  const normalized = String(value).trim();
  if (!normalized || normalized.length > maxLength) return null;
  return normalized;
}

function parseDateFilter(value) {
  if (value === undefined) return undefined;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseAuditQuery(query) {
  const action = optionalFilter(query.action);
  const entityType = optionalFilter(query.entityType);
  const entityId = optionalFilter(query.entityId);
  const from = parseDateFilter(query.from);
  const to = parseDateFilter(query.to);
  if ([action, entityType, entityId, from, to].includes(null)) {
    return { error: 'Audit filters are invalid or too long' };
  }
  if (from && to && from > to) return { error: 'from must be before or equal to to' };

  const where = {};
  if (action) where.action = action;
  if (entityType) where.entityType = entityType;
  if (entityId) where.entityId = entityId;
  if (from || to) where.createdAt = { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) };
  return {
    where,
    filters: {
      ...(action ? { action } : {}),
      ...(entityType ? { entityType } : {}),
      ...(entityId ? { entityId } : {}),
      ...(from ? { from: from.toISOString() } : {}),
      ...(to ? { to: to.toISOString() } : {}),
    },
  };
}

router.use(requireAuth(['admin']));

router.get('/', async (req, res) => {
  const parsed = parseAuditQuery(req.query);
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  const { page, limit, skip, take } = parsePagination(req.query);
  try {
    const [items, total] = await Promise.all([
      prisma.adminAuditLog.findMany({
        where: parsed.where,
        skip,
        take,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: {
          id: true,
          adminIdentifier: true,
          action: true,
          entityType: true,
          entityId: true,
          beforeSummary: true,
          afterSummary: true,
          createdAt: true,
        },
      }),
      prisma.adminAuditLog.count({ where: parsed.where }),
    ]);
    res.setHeader('Cache-Control', 'private, no-store');
    return res.json({
      items,
      filters: parsed.filters,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('[admin-audit-logs/list]', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
module.exports.parseAuditQuery = parseAuditQuery;
