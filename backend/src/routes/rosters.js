const express = require('express');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');
const { createRateLimiters } = require('../middleware/security');
const { rosterCreateSchema, rosterPassengerSchema } = require('../schemas');
const { validate, parsePagination } = require('../crud');
const { writeAdminAudit } = require('../lib/adminAudit');
const { acquireRosterPublicationLock } = require('../lib/rosterPublicationLock');
const {
  RosterExchangeError,
  buildRosterExportCsv,
  buildRosterExportXlsx,
  buildTemplateCsv,
  buildTemplateXlsx,
  loadRouteReferences,
  loadValidationContext,
  parseRosterFile,
  previewRosterImport,
  summarizeResults,
  validateRosterRows,
} = require('../lib/rosterExchange');

const router = express.Router();
const { rosterImport: rosterImportRateLimiter } = createRateLimiters();

function rosterAuditSummary(roster) {
  return {
    name: roster?.name ?? null,
    academicYear: roster?.academicYear ?? null,
    version: roster?.version ?? null,
    status: roster?.status ?? null,
  };
}

function passengerAssignmentSummary(passenger) {
  return {
    rosterId: passenger?.rosterId ?? null,
    passengerType: passenger?.passengerType ?? null,
    routeServiceId: passenger?.routeServiceId ?? null,
    boardingStopId: passenger?.boardingStopId ?? null,
  };
}

const rosterUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 0, parts: 2 },
  fileFilter: (_req, file, callback) => {
    const extension = path.extname(file.originalname || '').toLowerCase();
    if (extension === '.csv' || extension === '.xlsx') return callback(null, true);
    return callback(new Error('Only .csv and .xlsx roster files are accepted'));
  },
});

function receiveRosterFile(req, res, next) {
  rosterUpload.single('file')(req, res, (error) => {
    if (!error) return next();
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'Roster file must not exceed 5 MB' });
    }
    return res.status(400).json({ error: error.message || 'Roster upload failed' });
  });
}

function sendExchangeError(res, error, scope) {
  if (error instanceof RosterExchangeError) {
    return res.status(error.statusCode).json({ error: error.message, ...(error.details || {}) });
  }
  console.error(`[${scope}]`, error);
  return res.status(500).json({ error: 'Roster file operation failed' });
}

function safeFilePart(value) {
  return String(value || 'roster').replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'roster';
}

function sendDownload(res, buffer, fileName, contentType) {
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  res.setHeader('Cache-Control', 'private, no-store');
  return res.send(buffer);
}

async function validateRoster(rosterId) {
  const roster = await prisma.transportRoster.findUnique({
    where: { id: rosterId },
    include: {
      passengers: {
        include: {
          routeService: { select: { id: true, routeNo: true, capacity: true } },
          boardingStop: { select: { id: true, name: true } },
        },
      },
    },
  });
  if (!roster) return { roster: null, errors: ['Roster not found'], warnings: [] };

  const errors = [];
  const warnings = [];
  if (!roster.passengers.length) errors.push({ code: 'EMPTY_ROSTER', message: 'Roster has no passengers' });

  const publishedSchedules = await prisma.scheduleVersion.findMany({
    where: { status: 'PUBLISHED' },
    select: {
      routeServiceId: true,
      stops: { select: { stopId: true } },
    },
  });
  const stopsByRoute = new Map(
    publishedSchedules.map((schedule) => [schedule.routeServiceId, new Set(schedule.stops.map((item) => item.stopId))])
  );

  const countsByRoute = new Map();
  const classKeys = new Set();
  for (const passenger of roster.passengers) {
    countsByRoute.set(passenger.routeServiceId, (countsByRoute.get(passenger.routeServiceId) || 0) + 1);
    const allowedStops = stopsByRoute.get(passenger.routeServiceId);
    if (!allowedStops) {
      errors.push({
        code: 'NO_PUBLISHED_SCHEDULE',
        passengerId: passenger.id,
        message: `Route ${passenger.routeService.routeNo} has no published schedule`,
      });
    } else if (!allowedStops.has(passenger.boardingStopId)) {
      errors.push({
        code: 'STOP_NOT_ON_ROUTE',
        passengerId: passenger.id,
        message: `${passenger.boardingStop.name} is not on route ${passenger.routeService.routeNo}`,
      });
    }

    if (passenger.passengerType === 'STUDENT') {
      if (!passenger.rollNo || !passenger.department || !passenger.year || !passenger.section) {
        errors.push({ code: 'INCOMPLETE_STUDENT', passengerId: passenger.id, message: `${passenger.name} has incomplete student details` });
      } else {
        classKeys.add(`${passenger.department}|${passenger.year}|${passenger.section}`);
      }
    } else if (!passenger.facultyId) {
      errors.push({ code: 'INCOMPLETE_FACULTY', passengerId: passenger.id, message: `${passenger.name} has no faculty ID` });
    }
  }

  const routes = await prisma.routeService.findMany({
    where: { id: { in: [...countsByRoute.keys()] } },
    select: { id: true, routeNo: true, capacity: true },
  });
  for (const route of routes) {
    const assigned = countsByRoute.get(route.id) || 0;
    if (assigned > route.capacity) {
      errors.push({
        code: 'OVER_CAPACITY',
        routeServiceId: route.id,
        message: `Route ${route.routeNo} is over capacity by ${assigned - route.capacity} (${assigned}/${route.capacity})`,
      });
    }
  }

  for (const key of classKeys) {
    const [department, year, section] = key.split('|');
    const advisor = await prisma.classAdvisor.findFirst({
      where: { department, year: Number(year), section },
      select: { id: true },
    });
    if (!advisor) {
      warnings.push({
        code: 'MISSING_ADVISOR',
        message: `No advisor is configured for ${department} Year ${year} Section ${section}`,
      });
    }
  }

  return { roster, errors, warnings };
}

router.use(requireAuth(['admin']));

router.get('/import/template', async (req, res) => {
  const format = String(req.query.format || 'xlsx').toLowerCase();
  if (!['csv', 'xlsx'].includes(format)) {
    return res.status(400).json({ error: 'format must be csv or xlsx' });
  }
  try {
    if (format === 'csv') {
      return sendDownload(res, buildTemplateCsv(), 'annual-roster-import-template.csv', 'text/csv; charset=utf-8');
    }
    const references = await loadRouteReferences(prisma);
    const buffer = await buildTemplateXlsx(references);
    return sendDownload(
      res,
      buffer,
      'annual-roster-import-template.xlsx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
  } catch (error) {
    console.error('[rosters/template]', error);
    return res.status(500).json({ error: 'Roster template could not be generated' });
  }
});

router.get('/:id/export', async (req, res) => {
  const rosterId = Number(req.params.id);
  const format = String(req.query.format || 'xlsx').toLowerCase();
  if (!Number.isInteger(rosterId) || rosterId <= 0) return res.status(400).json({ error: 'Invalid roster ID' });
  if (!['csv', 'xlsx'].includes(format)) return res.status(400).json({ error: 'format must be csv or xlsx' });
  try {
    const roster = await prisma.transportRoster.findUnique({ where: { id: rosterId } });
    if (!roster) return res.status(404).json({ error: 'Roster not found' });
    const passengers = await prisma.rosterPassenger.findMany({
      where: { rosterId },
      include: {
        routeService: { select: { routeNo: true, name: true } },
        boardingStop: { select: { name: true } },
      },
      orderBy: [{ routeService: { routeNo: 'asc' } }, { name: 'asc' }],
    });
    const fileBase = `transport-roster-${safeFilePart(roster.academicYear)}-v${roster.version}`;
    const buffer = format === 'csv'
      ? buildRosterExportCsv(passengers)
      : await buildRosterExportXlsx(roster, passengers);
    await prisma.$transaction((tx) => writeAdminAudit(tx, req, {
        action: 'ROSTER_EXPORTED',
        entityType: 'TransportRoster',
        entityId: roster.id,
        afterSummary: { format, passengerRows: passengers.length, academicYear: roster.academicYear, version: roster.version },
      }));
    return sendDownload(
      res,
      buffer,
      `${fileBase}.${format}`,
      format === 'csv' ? 'text/csv; charset=utf-8' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
  } catch (error) {
    console.error('[rosters/export]', error);
    return res.status(500).json({ error: 'Roster export could not be generated' });
  }
});

router.post('/:id/import/preview', rosterImportRateLimiter, receiveRosterFile, async (req, res) => {
  const rosterId = Number(req.params.id);
  if (!Number.isInteger(rosterId) || rosterId <= 0) return res.status(400).json({ error: 'Invalid roster ID' });
  if (!req.file) return res.status(400).json({ error: 'Upload one file using the multipart field named file' });

  const previewDigest = String(req.get('x-preview-digest') || '');
  const rosterVersion = Number(req.get('x-roster-version'));
  const actualDigest = crypto.createHash('sha256').update(req.file.buffer).digest('hex');
  if (!/^[a-f0-9]{64}$/.test(previewDigest) || previewDigest !== actualDigest || req.body?.confirmed !== 'true') {
    return res.status(409).json({ error: 'Preview this exact file and explicitly confirm it before import' });
  }
  try {
    const preview = await previewRosterImport(prisma, rosterId, req.file.buffer, req.file.originalname);
    const { normalizedRows: _internalRows, ...clientPreview } = preview;
    return res.json(clientPreview);
  } catch (error) {
    return sendExchangeError(res, error, 'rosters/import-preview');
  }
});

router.post('/:id/import', rosterImportRateLimiter, receiveRosterFile, async (req, res) => {
  const rosterId = Number(req.params.id);
  if (!Number.isInteger(rosterId) || rosterId <= 0) return res.status(400).json({ error: 'Invalid roster ID' });
  if (!req.file) return res.status(400).json({ error: 'Upload one file using the multipart field named file' });

  try {
    const parsed = await parseRosterFile(req.file.buffer, req.file.originalname);
    const imported = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "TransportRoster" WHERE "id" = ${rosterId} FOR UPDATE`;
      const { roster, context } = await loadValidationContext(tx, rosterId);
      if (roster.version !== rosterVersion) {
        throw new RosterExchangeError('Roster version changed; preview the file again', 409);
      }
      const results = validateRosterRows(parsed.rows, context);
      const summary = summarizeResults(results);
      if (summary.invalidRows > 0) {
        throw new RosterExchangeError('Import validation failed; no rows were added', 400, {
          summary,
          unknownHeaders: parsed.unknownHeaders,
          rows: results.filter((row) => !row.valid || row.warnings.length).map((row) => ({
            rowNumber: row.rowNumber,
            valid: row.valid,
            errors: row.errors,
            warnings: row.warnings,
          })),
        });
      }

      const data = results.map((result) => {
        const { routeNo: _routeNo, boardingStop: _boardingStop, ...passenger } = result.normalized;
        return { rosterId, ...passenger };
      });
      for (let offset = 0; offset < data.length; offset += 500) {
        await tx.rosterPassenger.createMany({ data: data.slice(offset, offset + 500) });
      }
      const existingRows = [...context.existingCountsByRoute.values()].reduce((total, count) => total + count, 0);
      await writeAdminAudit(tx, req, {
        action: 'ROSTER_FILE_IMPORTED',
        entityType: 'TransportRoster',
        entityId: roster.id,
        beforeSummary: { passengerRows: existingRows },
        afterSummary: {
          passengerRows: existingRows + data.length,
          importedRows: data.length,
          format: parsed.format,
        },
      });
      return {
        roster: { id: roster.id, name: roster.name, academicYear: roster.academicYear, version: roster.version },
        importedRows: data.length,
        summary,
        unknownHeaders: parsed.unknownHeaders,
        warnings: results.filter((row) => row.warnings.length).map((row) => ({ rowNumber: row.rowNumber, warnings: row.warnings })),
      };
    }, { maxWait: 5_000, timeout: 30_000 });
    return res.status(201).json(imported);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Roster identifiers changed during import; preview the file again' });
    }
    if (error.code === 'P2003') {
      return res.status(409).json({ error: 'A referenced route or stop changed during import; preview the file again' });
    }
    return sendExchangeError(res, error, 'rosters/import');
  }
});

router.get('/', async (_req, res) => {
  const rosters = await prisma.transportRoster.findMany({
    include: { _count: { select: { passengers: true, trips: true } } },
    orderBy: [{ academicYear: 'desc' }, { version: 'desc' }],
  });
  return res.json(rosters);
});

router.post('/', async (req, res) => {
  const input = validate(rosterCreateSchema, req.body, res);
  if (!input) return;

  const latest = await prisma.transportRoster.findFirst({
    where: { academicYear: input.academicYear },
    orderBy: { version: 'desc' },
    select: { version: true },
  });

  try {
    const roster = await prisma.$transaction(async (tx) => {
      const created = await tx.transportRoster.create({
        data: {
          name: input.name,
          academicYear: input.academicYear,
          version: (latest?.version || 0) + 1,
        },
      });
      let copiedPassengers = 0;
      if (input.copyFromRosterId) {
        const source = await tx.rosterPassenger.findMany({ where: { rosterId: input.copyFromRosterId } });
        if (!source.length) throw Object.assign(new Error('Source roster has no passengers'), { statusCode: 400 });
        const copied = await tx.rosterPassenger.createMany({
          data: source.map(({ id, rosterId, createdAt, updatedAt, ...passenger }) => ({
            ...passenger,
            rosterId: created.id,
          })),
        });
        copiedPassengers = copied.count;
      }
      await writeAdminAudit(tx, req, {
        action: 'ROSTER_CREATED',
        entityType: 'TransportRoster',
        entityId: created.id,
        afterSummary: {
          ...rosterAuditSummary(created),
          copiedFromRosterId: input.copyFromRosterId || null,
          copiedPassengers,
        },
      });
      return created;
    });
    return res.status(201).json(roster);
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    if (error.code === 'P2002') return res.status(409).json({ error: 'A roster version already exists' });
    console.error('[rosters/create]', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', async (req, res) => {
  const rosterId = Number(req.params.id);
  const { page, limit, skip, take } = parsePagination(req.query);
  const roster = await prisma.transportRoster.findUnique({ where: { id: rosterId } });
  if (!roster) return res.status(404).json({ error: 'Roster not found' });
  const [passengers, total] = await Promise.all([
    prisma.rosterPassenger.findMany({
      where: { rosterId },
      skip,
      take,
      include: { routeService: true, boardingStop: true },
      orderBy: [{ routeService: { routeNo: 'asc' } }, { name: 'asc' }],
    }),
    prisma.rosterPassenger.count({ where: { rosterId } }),
  ]);
  return res.json({
    roster,
    passengers,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

router.post('/:id/passengers', async (req, res) => {
  const rosterId = Number(req.params.id);
  const input = validate(rosterPassengerSchema, req.body, res);
  if (!input) return;
  const roster = await prisma.transportRoster.findUnique({ where: { id: rosterId } });
  if (!roster) return res.status(404).json({ error: 'Roster not found' });
  if (roster.status !== 'DRAFT') return res.status(409).json({ error: 'Only draft rosters can be edited' });
  try {
    const passenger = await prisma.$transaction(async (tx) => {
      const created = await tx.rosterPassenger.create({
        data: { rosterId, ...input },
        include: { routeService: true, boardingStop: true },
      });
      await writeAdminAudit(tx, req, {
        action: 'ROSTER_PASSENGER_ADDED',
        entityType: 'RosterPassenger',
        entityId: created.id,
        afterSummary: passengerAssignmentSummary(created),
      });
      return created;
    });
    return res.status(201).json(passenger);
  } catch (error) {
    if (error.code === 'P2002') return res.status(409).json({ error: 'Bus-pass, roll, or faculty ID is duplicated in this roster' });
    if (error.code === 'P2003') return res.status(400).json({ error: 'Route or boarding stop does not exist' });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/passengers/bulk', async (req, res) => {
  const rosterId = Number(req.params.id);
  const rows = req.body?.rows;
  if (!Array.isArray(rows) || !rows.length || rows.length > 10000) {
    return res.status(400).json({ error: 'rows must contain between 1 and 10000 passengers' });
  }
  const roster = await prisma.transportRoster.findUnique({ where: { id: rosterId } });
  if (!roster) return res.status(404).json({ error: 'Roster not found' });
  if (roster.status !== 'DRAFT') return res.status(409).json({ error: 'Only draft rosters can be edited' });

  const parsed = rows.map((row, index) => ({ index, result: rosterPassengerSchema.safeParse(row) }));
  const invalid = parsed
    .filter(({ result }) => !result.success)
    .map(({ index, result }) => ({ row: index + 1, errors: result.error.issues.map((issue) => issue.message) }));
  if (invalid.length) return res.status(400).json({ error: 'Bulk validation failed', invalid });

  try {
    const result = await prisma.$transaction(async (tx) => {
      const created = await tx.rosterPassenger.createMany({
        data: parsed.map(({ result: parsedResult }) => ({ rosterId, ...parsedResult.data })),
      });
      await writeAdminAudit(tx, req, {
        action: 'ROSTER_PASSENGERS_BULK_ADDED',
        entityType: 'TransportRoster',
        entityId: rosterId,
        afterSummary: { addedPassengers: created.count },
      });
      return created;
    });
    return res.status(201).json({ imported: result.count });
  } catch (error) {
    if (error.code === 'P2002') return res.status(409).json({ error: 'The import contains duplicate identifiers' });
    if (error.code === 'P2003') return res.status(400).json({ error: 'The import contains an unknown route or stop' });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id/passengers/:passengerId', async (req, res) => {
  const rosterId = Number(req.params.id);
  const input = validate(rosterPassengerSchema, req.body, res);
  if (!input) return;
  const roster = await prisma.transportRoster.findUnique({ where: { id: rosterId } });
  if (!roster) return res.status(404).json({ error: 'Roster not found' });
  if (roster.status !== 'DRAFT') return res.status(409).json({ error: 'Only draft rosters can be edited' });
  const existing = await prisma.rosterPassenger.findFirst({
    where: { id: Number(req.params.passengerId), rosterId },
  });
  if (!existing) return res.status(404).json({ error: 'Passenger not found in this roster' });
  try {
const passenger = await prisma.$transaction(async (tx) => {
      const updated = await tx.rosterPassenger.update({ where: { id: existing.id }, data: input });
      await writeAdminAudit(tx, req, {
        action: 'ROSTER_PASSENGER_UPDATED',
        entityType: 'RosterPassenger',
        entityId: existing.id,
        beforeSummary: passengerAssignmentSummary(existing),
        afterSummary: passengerAssignmentSummary(updated),
      });
      return updated;
    });
    return res.json(passenger);
  } catch (error) {
    if (error.code === 'P2002') return res.status(409).json({ error: 'Bus-pass, roll, or faculty ID is duplicated in this roster' });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id/passengers/:passengerId', async (req, res) => {
  const rosterId = Number(req.params.id);
  const roster = await prisma.transportRoster.findUnique({ where: { id: rosterId } });
  if (!roster) return res.status(404).json({ error: 'Roster not found' });
  if (roster.status !== 'DRAFT') return res.status(409).json({ error: 'Only draft rosters can be edited' });
  const passengerId = Number(req.params.passengerId);
  const existing = await prisma.rosterPassenger.findFirst({ where: { id: passengerId, rosterId } });
  if (!existing) return res.status(404).json({ error: 'Passenger not found in this roster' });
  await prisma.$transaction(async (tx) => {
    await tx.rosterPassenger.delete({ where: { id: passengerId } });
    await writeAdminAudit(tx, req, {
      action: 'ROSTER_PASSENGER_REMOVED',
      entityType: 'RosterPassenger',
      entityId: passengerId,
      beforeSummary: passengerAssignmentSummary(existing),
    });
  });
  return res.json({ deleted: true });
});

router.post('/:id/validate', async (req, res) => {
  const { roster, errors, warnings } = await validateRoster(Number(req.params.id));
  if (!roster) return res.status(404).json({ error: 'Roster not found' });
  return res.json({ valid: errors.length === 0, errors, warnings });
});

router.post('/:id/publish', async (req, res) => {
  const id = Number(req.params.id);
  const { roster, errors, warnings } = await validateRoster(id);
  if (!roster) return res.status(404).json({ error: 'Roster not found' });
  if (roster.status !== 'DRAFT') return res.status(409).json({ error: 'Only a draft roster can be published' });
  if (req.body?.confirmed !== true) {
    return res.status(400).json({ error: 'confirmed must be true to replace the published roster' });
  }
  if (errors.length) return res.status(400).json({ error: 'Roster validation failed', errors, warnings });

  const published = await prisma.$transaction(async (tx) => {
    await acquireRosterPublicationLock(tx);
    const lockedRoster = await tx.transportRoster.findUnique({ where: { id } });
    if (!lockedRoster || lockedRoster.status !== 'DRAFT') {
      throw Object.assign(new Error('Roster changed while publication was waiting; reload and confirm again'), { statusCode: 409 });
    }
    const previous = await tx.transportRoster.findMany({
      where: { status: 'PUBLISHED' }, select: { id: true, academicYear: true },
    });
    const previousIds = previous.map((item) => item.id);
    const affectedTrips = previousIds.length ? (await tx.trip.findMany({
      where: { rosterId: { in: previousIds } },
      select: { id: true, rosterId: true, routeServiceId: true, status: true, rosterSnapshot: true },
    })).filter((trip) => !trip.rosterSnapshot) : [];
    for (const trip of affectedTrips) {
      const passengers = await tx.rosterPassenger.findMany({
        where: { rosterId: trip.rosterId, routeServiceId: trip.routeServiceId },
        select: {
          passengerType: true, name: true, rollNo: true, department: true, year: true,
          section: true, boardingStopId: true,
        },
      });
      const students = passengers
        .filter((item) => item.passengerType === 'STUDENT')
        .map(({ passengerType: _type, ...item }) => item);
      const snapshot = {
        rosterId: trip.rosterId,
        academicYear: previous.find((item) => item.id === trip.rosterId)?.academicYear || null,
        passengerCount: passengers.length,
        studentCount: students.length,
        facultyCount: passengers.length - students.length,
        ...(trip.status === 'RUNNING' ? { students } : {}),
      };
      await tx.trip.update({
        where: { id: trip.id },
        data: {
          rosterSnapshot: snapshot,
          rosterSnapshotKind: trip.status === 'RUNNING' ? 'OPERATIONAL' : 'COMPACT',
          snapshotCapturedAt: new Date(),
        },
      });
    }
    const archived = await tx.transportRoster.updateMany({
      where: { status: 'PUBLISHED' },
      data: { status: 'ARCHIVED' },
    });
    const updated = await tx.transportRoster.update({
      where: { id },
      data: { status: 'PUBLISHED', publishedAt: new Date() },
    });
    await writeAdminAudit(tx, req, {
      action: 'ROSTER_PUBLISHED',
      entityType: 'TransportRoster',
      entityId: id,
      beforeSummary: rosterAuditSummary(roster),
      afterSummary: {
        ...rosterAuditSummary(updated),
        archivedRosters: archived.count,
        protectedTrips: affectedTrips.length,
        passengerPurge: 'DEFERRED_PENDING_EXPLICIT_AUTHORIZATION',
      },
    });
    return updated;
  }).catch((error) => ({ publicationError: error }));
  if (published.publicationError) {
    const error = published.publicationError;
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    throw error;
  }
  return res.json({ roster: published, warnings });
});

module.exports = router;
module.exports.validateRoster = validateRoster;
