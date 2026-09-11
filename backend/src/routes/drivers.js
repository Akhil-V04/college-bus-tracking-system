const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const multer = require('multer');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');
const { driverCreateSchema, driverUpdateSchema } = require('../schemas');
const { parsePagination, validate } = require('../crud');
const { writeAdminAudit } = require('../lib/adminAudit');
const { createRateLimiters } = require('../middleware/security');
const {
  DriverExchangeError,
  buildDriverTemplate,
  loadDriverMaster,
  masterFingerprint,
  previewDriverImport,
} = require('../lib/driverExchange');

const router = express.Router();
const { rosterImport: driverImportLimiter } = createRateLimiters();
const receiveDriverFile = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => callback(null, /\.xlsx$/i.test(file.originalname)),
}).single('file');

function driverAuditSummary(driver) {
  return {
    driverCode: driver?.driverCode ?? null,
    sessionVersion: driver?.sessionVersion ?? null,
    status: driver?.status ?? null,
    assignedRouteId: driver?.assignedRoute?.id ?? null,
  };
}

const adminSelect = {
  id: true,
  driverCode: true,
  name: true,
  phone: true,
  licenseNo: true,
  sessionVersion: true,
  status: true,
  deactivatedAt: true,
  deactivationReason: true,
  createdAt: true,
  updatedAt: true,
  assignedRoute: { select: { id: true, routeNo: true, name: true } },
};

router.use(requireAuth(['admin']));

router.get('/import/template', async (_req, res) => {
  try {
    const buffer = await buildDriverTemplate(prisma);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="driver-import-template.xlsx"');
    return res.send(buffer);
  } catch (error) {
    console.error('[drivers/template]', error);
    return res.status(500).json({ error: 'Driver template could not be generated' });
  }
});

router.post('/import/preview', driverImportLimiter, receiveDriverFile, async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Upload one XLSX file using the field named file' });
  try {
    const preview = await previewDriverImport(prisma, req.file.buffer);
    const { normalizedRows: _rows, removalIds: _removalIds, ...safePreview } = preview;
    return res.json(safePreview);
  } catch (error) {
    if (error instanceof DriverExchangeError) {
      return res.status(error.statusCode).json({ error: error.message, ...(error.details || {}) });
    }
    console.error('[drivers/import-preview]', error);
    return res.status(500).json({ error: 'Driver import preview failed' });
  }
});

router.post('/import/confirm', driverImportLimiter, receiveDriverFile, async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Upload one XLSX file using the field named file' });
  const expectedDigest = String(req.get('x-preview-digest') || '');
  const expectedMaster = String(req.get('x-driver-master-version') || '');
  const actualDigest = crypto.createHash('sha256').update(req.file.buffer).digest('hex');
  if (req.body?.confirmed !== 'true' || expectedDigest !== actualDigest ||
      !/^[a-f0-9]{64}$/.test(expectedDigest) || !/^[a-f0-9]{64}$/.test(expectedMaster)) {
    return res.status(409).json({ error: 'Preview this exact workbook and explicitly confirm it before import' });
  }
  try {
    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRawUnsafe(
        'SELECT 1::int AS locked FROM (SELECT pg_advisory_xact_lock($1)) AS acquired',
        753423
      );
      const current = await loadDriverMaster(tx);
      if (masterFingerprint(current) !== expectedMaster) {
        throw new DriverExchangeError('Driver master data changed; preview the workbook again', 409);
      }
      const preview = await previewDriverImport(tx, req.file.buffer);
      if (preview.summary.invalidRows || preview.summary.blockedRemovals) {
        throw new DriverExchangeError('Driver import contains errors or removes a driver with a running trip', 409, {
          summary: preview.summary,
          rows: preview.rows.filter((row) => !row.valid),
          removals: preview.removals.filter((item) => item.activeTripId),
        });
      }
      const rows = preview.normalizedRows.filter((row) => row.valid);
      const existingRows = rows.filter((row) => row.existingId);
      if (current.length) {
        await tx.routeService.updateMany({
          where: { driverId: { in: current.map((driver) => driver.id) } }, data: { driverId: null },
        });
      }
      for (const row of existingRows) {
        await tx.driver.update({
          where: { id: row.existingId },
          data: {
            phone: `IMPORT-PHONE-${row.existingId}-${crypto.randomUUID()}`,
            licenseNo: `IMPORT-LICENSE-${row.existingId}-${crypto.randomUUID()}`,
          },
        });
      }
      const credentials = [];
      const imported = [];
      for (const row of rows) {
        let driver;
        if (row.existingId) {
          driver = await tx.driver.update({
            where: { id: row.existingId },
            data: {
              driverCode: row.driverCode, name: row.name, phone: row.phone, licenseNo: row.licenseNo,
              status: 'ACTIVE', deactivatedAt: null, deactivationReason: null,
            },
          });
        } else {
          const initialPassword = crypto.randomBytes(18).toString('base64url');
          driver = await tx.driver.create({
            data: {
              driverCode: row.driverCode, name: row.name, phone: row.phone, licenseNo: row.licenseNo,
              passwordHash: await bcrypt.hash(initialPassword, 10), status: 'ACTIVE',
            },
          });
          credentials.push({ driverCode: driver.driverCode, initialPassword });
        }
        if (row.routeServiceId) {
          await tx.routeService.update({ where: { id: row.routeServiceId }, data: { driverId: driver.id } });
        }
        imported.push({ id: driver.id, driverCode: driver.driverCode, action: row.existingId ? 'UPDATED' : 'CREATED' });
      }
      if (preview.removalIds.length) {
        await tx.driver.updateMany({
          where: { id: { in: preview.removalIds } },
          data: {
            status: 'INACTIVE', deactivatedAt: new Date(),
            deactivationReason: 'REMOVED_BY_CONFIRMED_IMPORT', sessionVersion: { increment: 1 },
          },
        });
      }
      await writeAdminAudit(tx, req, {
        action: 'DRIVER_FILE_IMPORTED', entityType: 'DriverMaster',
        afterSummary: {
          created: preview.summary.create, updated: preview.summary.update,
          unchanged: preview.summary.unchanged, deactivated: preview.summary.deactivate,
          provisionedCredentials: credentials.length,
        },
      });
      return { summary: preview.summary, imported, credentials };
    }, { isolationLevel: 'Serializable', maxWait: 5000, timeout: 30000 });
    res.setHeader('Cache-Control', 'private, no-store');
    return res.json({ ...result, credentialsShownOnce: true });
  } catch (error) {
    if (error instanceof DriverExchangeError) {
      return res.status(error.statusCode).json({ error: error.message, ...(error.details || {}) });
    }
    if (error.code === 'P2002' || error.code === 'P2034') {
      return res.status(409).json({ error: 'Driver data changed or conflicts; preview the workbook again' });
    }
    console.error('[drivers/import-confirm]', error);
    return res.status(500).json({ error: 'Driver import failed; no changes were applied' });
  }
});

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
    const reason = String(req.body?.reason || 'REMOVED_BY_ADMIN').trim().slice(0, 500);
    const result = await prisma.$transaction(async (tx) => {
      const before = await tx.driver.findUnique({ where: { id }, include: { assignedRoute: true } });
      if (!before) return { statusCode: 404 };
      const running = await tx.trip.findFirst({
        where: { driverId: id, status: 'RUNNING' },
        select: { id: true },
      });
      if (running) return { statusCode: 409, tripId: running.id };
      if (before.assignedRoute) {
        await tx.routeService.update({ where: { id: before.assignedRoute.id }, data: { driverId: null } });
      }
      const updated = await tx.driver.update({
        where: { id },
        data: {
          status: 'INACTIVE',
          deactivatedAt: new Date(),
          deactivationReason: reason,
          sessionVersion: { increment: 1 },
        },
        select: adminSelect,
      });
      await writeAdminAudit(tx, req, {
        action: 'DRIVER_DEACTIVATED',
        entityType: 'Driver',
        entityId: id,
        beforeSummary: driverAuditSummary(before),
        afterSummary: driverAuditSummary(updated),
      });
      return { statusCode: 200, updated };
    });
    if (result.statusCode === 404) return res.status(404).json({ error: 'Driver not found' });
    if (result.statusCode === 409) {
      return res.status(409).json({
        error: 'Transfer or end the active trip before deactivating this driver',
        tripId: result.tripId,
      });
    }
    return res.json({ deactivated: true, driver: result.updated });
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'Driver not found' });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
