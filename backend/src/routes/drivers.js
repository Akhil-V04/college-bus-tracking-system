const express = require('express');
const bcrypt = require('bcrypt');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');
const { driverCreateSchema, driverUpdateSchema } = require('../schemas');
const { parsePagination, validate } = require('../crud');
const { writeAdminAudit } = require('../lib/adminAudit');

const router = express.Router();

function driverAuditSummary(driver) {
  return {
    driverCode: driver?.driverCode ?? null,
    sessionVersion: driver?.sessionVersion ?? null,
  };
}

const adminSelect = {
  id: true,
  driverCode: true,
  name: true,
  phone: true,
  licenseNo: true,
  sessionVersion: true,
  createdAt: true,
  updatedAt: true,
  assignedRoute: { select: { id: true, routeNo: true, name: true } },
};

router.use(requireAuth(['admin']));

router.get('/', async (req, res) => {
  const { page, limit, skip, take } = parsePagination(req.query);
  const [items, total] = await Promise.all([
    prisma.driver.findMany({ skip, take, select: adminSelect, orderBy: { driverCode: 'asc' } }),
    prisma.driver.count(),
  ]);
  return res.json({ items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
});

router.post('/', async (req, res) => {
  const input = validate(driverCreateSchema, req.body, res);
  if (!input) return;
  const { password, ...data } = input;
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const driver = await prisma.$transaction(async (tx) => {
      const created = await tx.driver.create({
        data: { ...data, passwordHash },
        select: adminSelect,
      });
      await writeAdminAudit(tx, req, {
        action: 'DRIVER_CREATED',
        entityType: 'Driver',
        entityId: created.id,
        afterSummary: driverAuditSummary(created),
      });
      return created;
    });
    return res.status(201).json(driver);
  } catch (error) {
    if (error.code === 'P2002') return res.status(409).json({ error: 'Driver code or phone number already exists' });
    console.error('[drivers/create]', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', async (req, res) => {
  const input = validate(driverUpdateSchema, req.body, res);
  if (!input) return;
  const { password, ...data } = input;
  if (password) {
    data.passwordHash = await bcrypt.hash(password, 10);
    data.sessionVersion = { increment: 1 };
  }
  try {
const id = Number(req.params.id);
    const driver = await prisma.$transaction(async (tx) => {
      const before = await tx.driver.findUnique({ where: { id } });
      const updated = await tx.driver.update({ where: { id }, data, select: adminSelect });
      await writeAdminAudit(tx, req, {
        action: 'DRIVER_UPDATED',
        entityType: 'Driver',
        entityId: id,
        beforeSummary: driverAuditSummary(before),
        afterSummary: {
          ...driverAuditSummary(updated),
          changedFields: Object.keys(input).sort(),
        },
      });
      return updated;
    });
    return res.json(driver);
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'Driver not found' });
    if (error.code === 'P2002') return res.status(409).json({ error: 'Driver code or phone number already exists' });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/revoke-sessions', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const driver = await prisma.$transaction(async (tx) => {
      const before = await tx.driver.findUnique({ where: { id }, select: { id: true, driverCode: true, sessionVersion: true } });
      const updated = await tx.driver.update({
        where: { id },
        data: { sessionVersion: { increment: 1 } },
        select: { id: true, driverCode: true, sessionVersion: true },
      });
      await writeAdminAudit(tx, req, {
        action: 'DRIVER_SESSIONS_REVOKED',
        entityType: 'Driver',
        entityId: id,
        beforeSummary: driverAuditSummary(before),
        afterSummary: driverAuditSummary(updated),
      });
      return updated;
    });
    return res.json({ revoked: true, id: driver.id, sessionVersion: driver.sessionVersion });
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'Driver not found' });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    await prisma.$transaction(async (tx) => {
      const before = await tx.driver.findUnique({ where: { id } });
      await tx.driver.delete({ where: { id } });
      await writeAdminAudit(tx, req, {
        action: 'DRIVER_DELETED',
        entityType: 'Driver',
        entityId: id,
        beforeSummary: driverAuditSummary(before),
      });
    });
    return res.json({ deleted: true });
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'Driver not found' });
    if (error.code === 'P2003') return res.status(409).json({ error: 'Driver has route or trip history and cannot be deleted' });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
