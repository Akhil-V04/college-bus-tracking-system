const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');
const { scheduleVersionSchema, scheduleStopSchema } = require('../schemas');
const { validate } = require('../crud');
const { writeAdminAudit } = require('../lib/adminAudit');

const router = express.Router();

function scheduleAuditSummary(schedule) {
  return {
    routeServiceId: schedule?.routeServiceId ?? null,
    name: schedule?.name ?? null,
    direction: schedule?.direction ?? null,
    version: schedule?.version ?? null,
    status: schedule?.status ?? null,
  };
}

function scheduleStopAuditSummary(entry) {
  return {
    scheduleVersionId: entry?.scheduleVersionId ?? null,
    stopId: entry?.stopId ?? null,
    sequenceOrder: entry?.sequenceOrder ?? null,
    scheduledTime: entry?.scheduledTime ?? null,
  };
}

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
    const schedule = await prisma.$transaction(async (tx) => {
      const created = await tx.scheduleVersion.create({
        data: { ...input, version: (latest?.version || 0) + 1 },
      });
      await writeAdminAudit(tx, req, {
        action: 'SCHEDULE_CREATED',
        entityType: 'ScheduleVersion',
        entityId: created.id,
        afterSummary: scheduleAuditSummary(created),
      });
      return created;
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
    const entry = await prisma.$transaction(async (tx) => {
      const created = await tx.scheduleStop.create({
        data: { scheduleVersionId: scheduleId, ...input },
        include: { stop: true },
      });
      await writeAdminAudit(tx, req, {
        action: 'SCHEDULE_STOP_ADDED',
        entityType: 'ScheduleStop',
        entityId: created.id,
        afterSummary: scheduleStopAuditSummary(created),
      });
      return created;
    });
    return res.status(201).json(entry);
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
  const stopEntryId = Number(req.params.stopEntryId);
  const existing = await prisma.scheduleStop.findFirst({ where: { id: stopEntryId, scheduleVersionId: scheduleId } });
  if (!existing) return res.status(404).json({ error: 'Schedule stop not found' });
  try {
    const entry = await prisma.$transaction(async (tx) => {
      const updated = await tx.scheduleStop.update({
        where: { id: stopEntryId },
        data: input,
        include: { stop: true },
      });
      await writeAdminAudit(tx, req, {
        action: 'SCHEDULE_STOP_UPDATED',
        entityType: 'ScheduleStop',
        entityId: stopEntryId,
        beforeSummary: scheduleStopAuditSummary(existing),
        afterSummary: scheduleStopAuditSummary(updated),
      });
      return updated;
    });
    return res.json(entry);
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
  const stopEntryId = Number(req.params.stopEntryId);
  const existing = await prisma.scheduleStop.findFirst({
    where: { id: stopEntryId, scheduleVersionId: schedule.id },
  });
  if (!existing) return res.status(404).json({ error: 'Schedule stop not found' });
  await prisma.$transaction(async (tx) => {
    await tx.scheduleStop.delete({ where: { id: stopEntryId } });
    await writeAdminAudit(tx, req, {
      action: 'SCHEDULE_STOP_REMOVED',
      entityType: 'ScheduleStop',
      entityId: stopEntryId,
      beforeSummary: scheduleStopAuditSummary(existing),
    });
  });
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
    const archived = await tx.scheduleVersion.updateMany({
      where: {
        routeServiceId: schedule.routeServiceId,
        direction: schedule.direction,
        status: 'PUBLISHED',
      },
      data: { status: 'ARCHIVED' },
    });
    const updated = await tx.scheduleVersion.update({
      where: { id },
      data: { status: 'PUBLISHED', publishedAt: new Date() },
      include: { stops: { orderBy: { sequenceOrder: 'asc' }, include: { stop: true } } },
    });
    await writeAdminAudit(tx, req, {
      action: 'SCHEDULE_PUBLISHED',
      entityType: 'ScheduleVersion',
      entityId: id,
      beforeSummary: scheduleAuditSummary(schedule),
      afterSummary: { ...scheduleAuditSummary(updated), archivedSchedules: archived.count },
    });
    return updated;
  });
  return res.json(published);
});

module.exports = router;
module.exports.validateSchedule = validateSchedule;
