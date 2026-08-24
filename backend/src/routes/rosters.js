const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');
const { rosterCreateSchema, rosterPassengerSchema } = require('../schemas');
const { validate, parsePagination } = require('../crud');

const router = express.Router();

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
      if (input.copyFromRosterId) {
        const source = await tx.rosterPassenger.findMany({ where: { rosterId: input.copyFromRosterId } });
        if (!source.length) throw Object.assign(new Error('Source roster has no passengers'), { statusCode: 400 });
        await tx.rosterPassenger.createMany({
          data: source.map(({ id, rosterId, createdAt, updatedAt, ...passenger }) => ({
            ...passenger,
            rosterId: created.id,
          })),
        });
      }
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
    return res.status(201).json(
      await prisma.rosterPassenger.create({
        data: { rosterId, ...input },
        include: { routeService: true, boardingStop: true },
      })
    );
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
    const result = await prisma.rosterPassenger.createMany({
      data: parsed.map(({ result }) => ({ rosterId, ...result.data })),
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
    select: { id: true },
  });
  if (!existing) return res.status(404).json({ error: 'Passenger not found in this roster' });
  try {
    return res.json(await prisma.rosterPassenger.update({ where: { id: existing.id }, data: input }));
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
  const result = await prisma.rosterPassenger.deleteMany({
    where: { id: Number(req.params.passengerId), rosterId },
  });
  if (!result.count) return res.status(404).json({ error: 'Passenger not found in this roster' });
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
  if (errors.length) return res.status(400).json({ error: 'Roster validation failed', errors, warnings });

  const published = await prisma.$transaction(async (tx) => {
    await tx.transportRoster.updateMany({ where: { status: 'PUBLISHED' }, data: { status: 'ARCHIVED' } });
    return tx.transportRoster.update({
      where: { id },
      data: { status: 'PUBLISHED', publishedAt: new Date() },
    });
  });
  return res.json({ roster: published, warnings });
});

module.exports = router;
module.exports.validateRoster = validateRoster;
