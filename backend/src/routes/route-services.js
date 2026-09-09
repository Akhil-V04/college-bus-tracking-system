const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');
const { routeServiceSchema } = require('../schemas');
const { parsePagination, validate } = require('../crud');
const { changedFields, writeAdminAudit } = require('../lib/adminAudit');

const router = express.Router();

const routeAuditFields = ['routeNo', 'name', 'areaCovered', 'capacity', 'driverId'];
function routeAuditSummary(route) {
  return Object.fromEntries(routeAuditFields.map((field) => [field, route?.[field] ?? null]));
}

const publicSelect = {
  id: true,
  routeNo: true,
  name: true,
  areaCovered: true,
  capacity: true,
  driver: { select: { name: true } },
};

// Passenger-safe list. Phone numbers and internal driver fields are never selected.
router.get('/', async (_req, res) => {
  try {
    const routes = await prisma.routeService.findMany({
      select: publicSelect,
      orderBy: { routeNo: 'asc' },
    });
    return res.json(routes);
  } catch (error) {
    console.error('[route-services/list]', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/mine', requireAuth(['driver']), async (req, res) => {
  const route = await prisma.routeService.findFirst({
    where: { driverId: Number(req.user.id) },
    select: {
      ...publicSelect,
      schedules: {
        where: { status: 'PUBLISHED' },
        orderBy: { publishedAt: 'desc' },
        take: 1,
        include: { stops: { orderBy: { sequenceOrder: 'asc' }, include: { stop: true } } },
      },
    },
  });
  if (!route) return res.status(404).json({ error: 'No route is assigned to this driver' });
  return res.json(route);
});

router.get('/admin', requireAuth(['admin']), async (req, res) => {
  const { page, limit, skip, take } = parsePagination(req.query);
  const [items, total] = await Promise.all([
    prisma.routeService.findMany({
      skip,
      take,
      include: { driver: { select: { id: true, driverCode: true, name: true, phone: true } } },
      orderBy: { routeNo: 'asc' },
    }),
    prisma.routeService.count(),
  ]);
  return res.json({ items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
});

router.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid route id' });
  const route = await prisma.routeService.findUnique({ where: { id }, select: publicSelect });
  if (!route) return res.status(404).json({ error: 'Route not found' });
  return res.json(route);
});

router.post('/', requireAuth(['admin']), async (req, res) => {
  const data = validate(routeServiceSchema, req.body, res);
  if (!data) return;
  try {
    const created = await prisma.$transaction(async (tx) => {
      const route = await tx.routeService.create({ data });
      await writeAdminAudit(tx, req, {
        action: 'ROUTE_CREATED',
        entityType: 'RouteService',
        entityId: route.id,
        afterSummary: routeAuditSummary(route),
      });
      return route;
    });
    return res.status(201).json(created);
  } catch (error) {
    if (error.code === 'P2002') return res.status(409).json({ error: 'Route number or driver assignment already exists' });
    console.error('[route-services/create]', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', requireAuth(['admin']), async (req, res) => {
  const id = Number(req.params.id);
  const data = validate(routeServiceSchema.partial(), req.body, res);
  if (!Number.isInteger(id) || !data) return;
  try {
const updated = await prisma.$transaction(async (tx) => {
      const before = await tx.routeService.findUnique({ where: { id } });
      const route = await tx.routeService.update({ where: { id }, data });
      await writeAdminAudit(tx, req, {
        action: 'ROUTE_UPDATED',
        entityType: 'RouteService',
        entityId: id,
        beforeSummary: routeAuditSummary(before),
        afterSummary: {
          ...routeAuditSummary(route),
          changedFields: changedFields(before, route, routeAuditFields),
        },
      });
      return route;
    });
    return res.json(updated);
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'Route not found' });
    if (error.code === 'P2002') return res.status(409).json({ error: 'Route number or driver assignment already exists' });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', requireAuth(['admin']), async (req, res) => {
  try {
    const id = Number(req.params.id);
    await prisma.$transaction(async (tx) => {
      const before = await tx.routeService.findUnique({ where: { id } });
      await tx.routeService.delete({ where: { id } });
      await writeAdminAudit(tx, req, {
        action: 'ROUTE_DELETED',
        entityType: 'RouteService',
        entityId: id,
        beforeSummary: routeAuditSummary(before),
      });
    });
    return res.json({ deleted: true });
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'Route not found' });
    if (error.code === 'P2003') {
      return res.status(409).json({ error: 'Route has schedules, roster entries, or trips and cannot be deleted' });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
