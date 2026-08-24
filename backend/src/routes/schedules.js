const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');
const { scheduleVersionSchema, scheduleStopSchema } = require('../schemas');
const { validate } = require('../crud');

const router = express.Router();

function timeToMinutes(value) {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

async function validateSchedule(scheduleId) {
  const schedule = await prisma.scheduleVersion.findUnique({
    where: { id: scheduleId },
    include: { stops: { orderBy: { sequenceOrder: 'asc' }, include: { stop: true } } },
  });
  if (!schedule) return { schedule: null, errors: ['Schedule not found'] };

  const errors = [];
  if (schedule.stops.length < 2) errors.push('A published schedule must contain at least two stops');
  for (let index = 1; index < schedule.stops.length; index += 1) {
    if (timeToMinutes(schedule.stops[index].scheduledTime) <= timeToMinutes(schedule.stops[index - 1].scheduledTime)) {
      errors.push(
        `${schedule.stops[index].stop.name} must be scheduled after ${schedule.stops[index - 1].stop.name}`
      );
    }
  }
  return { schedule, errors };
}

router.get('/route/:routeServiceId', async (req, res) => {
  const schedule = await prisma.scheduleVersion.findFirst({
    where: { routeServiceId: Number(req.params.routeServiceId), status: 'PUBLISHED' },
    orderBy: { publishedAt: 'desc' },
    select: {
      id: true,
      name: true,
      direction: true,
      version: true,
      effectiveFrom: true,
      stops: {
        orderBy: { sequenceOrder: 'asc' },
        select: {
          id: true,
          sequenceOrder: true,
          scheduledTime: true,
          stop: { select: { id: true, name: true, latitude: true, longitude: true } },
        },
      },
    },
  });
  if (!schedule) return res.status(404).json({ error: 'No published schedule for this route' });
  return res.json(schedule);
});

router.use(requireAuth(['admin']));

router.get('/', async (req, res) => {
  const schedules = await prisma.scheduleVersion.findMany({
    include: { routeService: true, _count: { select: { stops: true } } },
    orderBy: [{ routeServiceId: 'asc' }, { version: 'desc' }],
  });
  return res.json(schedules);
});

router.post('/', async (req, res) => {
  const input = validate(scheduleVersionSchema, req.body, res);
  if (!input) return;
  const latest = await prisma.scheduleVersion.findFirst({
    where: { routeServiceId: input.routeServiceId, direction: input.direction },
    orderBy: { version: 'desc' },
    select: { version: true },
  });
  try {
    const schedule = await prisma.scheduleVersion.create({
      data: { ...input, version: (latest?.version || 0) + 1 },
    });
    return res.status(201).json(schedule);
  } catch (error) {
    if (error.code === 'P2003') return res.status(400).json({ error: 'Route does not exist' });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', async (req, res) => {
  const schedule = await prisma.scheduleVersion.findUnique({
    where: { id: Number(req.params.id) },
    include: { routeService: true, stops: { orderBy: { sequenceOrder: 'asc' }, include: { stop: true } } },
  });
  if (!schedule) return res.status(404).json({ error: 'Schedule not found' });
  return res.json(schedule);
});

router.post('/:id/stops', async (req, res) => {
  const input = validate(scheduleStopSchema, req.body, res);
  if (!input) return;
  const scheduleId = Number(req.params.id);
  const schedule = await prisma.scheduleVersion.findUnique({ where: { id: scheduleId } });
  if (!schedule) return res.status(404).json({ error: 'Schedule not found' });
  if (schedule.status !== 'DRAFT') return res.status(409).json({ error: 'Only draft schedules can be edited' });
  try {
    return res.status(201).json(
      await prisma.scheduleStop.create({ data: { scheduleVersionId: scheduleId, ...input }, include: { stop: true } })
    );
  } catch (error) {
    if (error.code === 'P2002') return res.status(409).json({ error: 'Stop or sequence already exists in this schedule' });
    if (error.code === 'P2003') return res.status(400).json({ error: 'Stop does not exist' });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id/stops/:stopEntryId', async (req, res) => {
  const input = validate(scheduleStopSchema.partial(), req.body, res);
  if (!input) return;
  const scheduleId = Number(req.params.id);
  const schedule = await prisma.scheduleVersion.findUnique({ where: { id: scheduleId } });
  if (!schedule) return res.status(404).json({ error: 'Schedule not found' });
  if (schedule.status !== 'DRAFT') return res.status(409).json({ error: 'Only draft schedules can be edited' });
  try {
    return res.json(
      await prisma.scheduleStop.update({
        where: { id: Number(req.params.stopEntryId) },
        data: input,
        include: { stop: true },
      })
    );
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'Schedule stop not found' });
    if (error.code === 'P2002') return res.status(409).json({ error: 'Stop or sequence already exists in this schedule' });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id/stops/:stopEntryId', async (req, res) => {
  const schedule = await prisma.scheduleVersion.findUnique({ where: { id: Number(req.params.id) } });
  if (!schedule) return res.status(404).json({ error: 'Schedule not found' });
  if (schedule.status !== 'DRAFT') return res.status(409).json({ error: 'Only draft schedules can be edited' });
  await prisma.scheduleStop.delete({ where: { id: Number(req.params.stopEntryId) } });
  return res.json({ deleted: true });
});

router.post('/:id/validate', async (req, res) => {
  const { schedule, errors } = await validateSchedule(Number(req.params.id));
  if (!schedule) return res.status(404).json({ error: 'Schedule not found' });
  return res.json({ valid: errors.length === 0, errors });
});

router.post('/:id/publish', async (req, res) => {
  const id = Number(req.params.id);
  const { schedule, errors } = await validateSchedule(id);
  if (!schedule) return res.status(404).json({ error: 'Schedule not found' });
  if (schedule.status !== 'DRAFT') return res.status(409).json({ error: 'Only a draft schedule can be published' });
  if (errors.length) return res.status(400).json({ error: 'Schedule validation failed', errors });

  const published = await prisma.$transaction(async (tx) => {
    await tx.scheduleVersion.updateMany({
      where: {
        routeServiceId: schedule.routeServiceId,
        direction: schedule.direction,
        status: 'PUBLISHED',
      },
      data: { status: 'ARCHIVED' },
    });
    return tx.scheduleVersion.update({
      where: { id },
      data: { status: 'PUBLISHED', publishedAt: new Date() },
      include: { stops: { orderBy: { sequenceOrder: 'asc' }, include: { stop: true } } },
    });
  });
  return res.json(published);
});

module.exports = router;
module.exports.validateSchedule = validateSchedule;
