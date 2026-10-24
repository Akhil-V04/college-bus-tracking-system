const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');
const { scheduleVersionSchema, scheduleStopSchema } = require('../schemas');
const { validate } = require('../crud');
const { writeAdminAudit } = require('../lib/adminAudit');
const { GoogleMapsGeometryError, requestRouteGeometry, fallbackRouteGeometry, computeRealRoadGeometry } = require('../lib/googleMapsGeometry');

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
  try {
    const routeServiceId = Number(req.params.routeServiceId);
    const now = new Date();

    // 1. Check if there is an active event/custom override schedule whose date range covers NOW
    const activeOverride = await prisma.scheduleVersion.findFirst({
      where: {
        routeServiceId,
        status: 'PUBLISHED',
        direction: 'EVENT_OVERRIDE',
        effectiveFrom: { lte: now },
        effectiveTo: { gte: now },
      },
      orderBy: { publishedAt: 'desc' },
      select: {
        id: true,
        name: true,
        direction: true,
        version: true,
        effectiveFrom: true,
        effectiveTo: true,
        geometryPolyline: true,
        geometryFormat: true,
        geometryDistanceMeters: true,
        geometryDurationSeconds: true,
        geometryGeneratedAt: true,
        geometryProvider: true,
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

    if (activeOverride) {
      return res.json({
        ...activeOverride,
        isEventOverride: true,
        remainingMinutes: Math.max(0, Math.round((new Date(activeOverride.effectiveTo) - now) / 60000)),
      });
    }

    // 2. Otherwise return standard published regular schedule
    const schedule = await prisma.scheduleVersion.findFirst({
      where: {
        routeServiceId,
        status: 'PUBLISHED',
        direction: { not: 'EVENT_OVERRIDE' },
      },
      orderBy: { publishedAt: 'desc' },
      select: {
        id: true,
        name: true,
        direction: true,
        version: true,
        effectiveFrom: true,
        effectiveTo: true,
        geometryPolyline: true,
        geometryFormat: true,
        geometryDistanceMeters: true,
        geometryDurationSeconds: true,
        geometryGeneratedAt: true,
        geometryProvider: true,
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
  } catch (error) {
    console.error('[schedules/route-get]', error);
    return res.status(500).json({ error: 'Failed to load route schedule' });
  }
});

router.post('/preview-geometry', async (req, res) => {
  const { stops = [] } = req.body;
  if (!Array.isArray(stops) || stops.length < 2) {
    return res.status(400).json({ error: 'At least two stops are required for road routing' });
  }
  try {
    const geometry = await computeRealRoadGeometry(stops);
    return res.json(geometry);
  } catch (error) {
    console.error('[preview-geometry]', error);
    return res.status(500).json({ error: 'Could not compute road geometry' });
  }
});

router.use(requireAuth(['admin']));

// List all custom event schedule overrides across routes
router.get('/overrides', async (req, res) => {
  const now = new Date();
  const overrides = await prisma.scheduleVersion.findMany({
    where: {
      direction: 'EVENT_OVERRIDE',
    },
    orderBy: { effectiveFrom: 'desc' },
    include: {
      routeService: { select: { id: true, routeNo: true, name: true } },
      stops: {
        orderBy: { sequenceOrder: 'asc' },
        include: { stop: true },
      },
    },
  });

  const formatted = overrides.map((ov) => {
    const isActive = ov.status === 'PUBLISHED' && ov.effectiveFrom && ov.effectiveTo &&
      new Date(ov.effectiveFrom) <= now && new Date(ov.effectiveTo) >= now;
    const isExpired = ov.effectiveTo && new Date(ov.effectiveTo) < now;
    return {
      id: ov.id,
      name: ov.name,
      routeServiceId: ov.routeServiceId,
      routeNo: ov.routeService?.routeNo || '??',
      routeName: ov.routeService?.name || 'Route',
      direction: ov.direction,
      status: ov.status,
      effectiveFrom: ov.effectiveFrom,
      effectiveTo: ov.effectiveTo,
      isActive,
      isExpired,
      stopsCount: ov.stops.length,
      firstStopTime: ov.stops[0]?.scheduledTime || '--:--',
      firstStopName: ov.stops[0]?.stop?.name || 'Start',
      lastStopTime: ov.stops[ov.stops.length - 1]?.scheduledTime || '--:--',
      lastStopName: ov.stops[ov.stops.length - 1]?.stop?.name || 'VBIT',
      geometryDistanceMeters: ov.geometryDistanceMeters,
      geometryDurationSeconds: ov.geometryDurationSeconds,
      stops: ov.stops.map((s) => ({
        id: s.id,
        sequenceOrder: s.sequenceOrder,
        scheduledTime: s.scheduledTime,
        stopId: s.stop.id,
        name: s.stop.name,
        latitude: s.stop.latitude,
        longitude: s.stop.longitude,
      })),
    };
  });

  return res.json(formatted);
});

// Create & publish a new event schedule override for a route
router.post('/route/:routeServiceId/create-override', async (req, res) => {
  const routeServiceId = Number(req.params.routeServiceId);
  const {
    name = 'Event Schedule Override',
    durationDays = 1,
    effectiveFrom,
    effectiveTo,
    stops = [],
  } = req.body;

  const route = await prisma.routeService.findUnique({ where: { id: routeServiceId } });
  if (!route) return res.status(404).json({ error: 'Route not found' });
  if (!Array.isArray(stops) || stops.length < 2) {
    return res.status(400).json({ error: 'At least two stops are required for an event schedule' });
  }

  // Calculate start & end date window
  const fromDate = effectiveFrom ? new Date(effectiveFrom) : new Date();
  let toDate = effectiveTo ? new Date(effectiveTo) : null;
  if (!toDate) {
    toDate = new Date(fromDate);
    toDate.setDate(toDate.getDate() + Number(durationDays || 1));
    toDate.setHours(23, 59, 59, 999);
  }

  // Generate turn-by-turn road geometry for the event schedule
  let geometry = null;
  try {
    geometry = await computeRealRoadGeometry(stops);
  } catch (geomErr) {
    console.warn('[create-override] geometry error:', geomErr);
  }

  // Find next version number for EVENT_OVERRIDE direction
  const maxVersion = await prisma.scheduleVersion.aggregate({
    where: { routeServiceId, direction: 'EVENT_OVERRIDE' },
    _max: { version: true },
  });
  const nextVersion = (maxVersion._max.version || 0) + 1;

  const result = await prisma.$transaction(async (tx) => {
    // 1. Resolve stopIds ensuring unique stops
    const usedStopIds = new Set();
    const resolvedStops = [];

    for (let i = 0; i < stops.length; i++) {
      const item = stops[i];
      let stop = null;

      if (item.stopId && !usedStopIds.has(Number(item.stopId))) {
        stop = await tx.stop.findUnique({ where: { id: Number(item.stopId) } });
      }

      if (!stop) {
        stop = await tx.stop.create({
          data: {
            name: String(item.name || `Stop ${i + 1}`).trim(),
            latitude: Number(item.latitude),
            longitude: Number(item.longitude),
          },
        });
      }

      usedStopIds.add(stop.id);
      resolvedStops.push({
        stopId: stop.id,
        sequenceOrder: i + 1,
        scheduledTime: String(item.scheduledTime || '08:00').trim(),
      });
    }

    // 2. Create the EVENT_OVERRIDE ScheduleVersion
    const overrideSchedule = await tx.scheduleVersion.create({
      data: {
        routeServiceId,
        name: String(name).trim() || `Route ${route.routeNo} Event Schedule`,
        direction: 'EVENT_OVERRIDE',
        status: 'PUBLISHED',
        version: nextVersion,
        effectiveFrom: fromDate,
        effectiveTo: toDate,
        publishedAt: new Date(),
        ...(geometry || {}),
      },
    });

    // 3. Create ScheduleStops
    for (const item of resolvedStops) {
      await tx.scheduleStop.create({
        data: {
          scheduleVersionId: overrideSchedule.id,
          stopId: item.stopId,
          sequenceOrder: item.sequenceOrder,
          scheduledTime: item.scheduledTime,
        },
      });
    }

    await writeAdminAudit(tx, req, {
      action: 'SCHEDULE_EVENT_OVERRIDE_CREATED',
      entityType: 'ScheduleVersion',
      entityId: overrideSchedule.id,
      afterSummary: {
        routeNo: route.routeNo,
        durationDays,
        effectiveFrom: fromDate,
        effectiveTo: toDate,
        stopsCount: resolvedStops.length,
      },
    });

    return overrideSchedule;
  });

  return res.status(201).json(result);
});

// Deactivate/cancel an event schedule override
router.post('/override/:id/deactivate', async (req, res) => {
  const id = Number(req.params.id);
  const schedule = await prisma.scheduleVersion.findUnique({ where: { id } });
  if (!schedule) return res.status(404).json({ error: 'Schedule override not found' });

  const updated = await prisma.$transaction(async (tx) => {
    const res = await tx.scheduleVersion.update({
      where: { id },
      data: {
        status: 'ARCHIVED',
        effectiveTo: new Date(),
      },
    });
    await writeAdminAudit(tx, req, {
      action: 'SCHEDULE_EVENT_OVERRIDE_DEACTIVATED',
      entityType: 'ScheduleVersion',
      entityId: id,
      afterSummary: {
        deactivatedAt: new Date(),
        originalEffectiveTo: schedule.effectiveTo,
      },
    });
    return res;
  });

  return res.json({ deactivated: true, schedule: updated });
});

router.get('/route/:routeServiceId/detail', async (req, res) => {
  const routeServiceId = Number(req.params.routeServiceId);
  if (!Number.isInteger(routeServiceId)) return res.status(400).json({ error: 'Invalid routeServiceId' });

  const draft = await prisma.scheduleVersion.findFirst({
    where: { routeServiceId, status: 'DRAFT' },
    orderBy: { version: 'desc' },
    include: {
      routeService: true,
      stops: { orderBy: { sequenceOrder: 'asc' }, include: { stop: true } },
    },
  });
  if (draft) return res.json(draft);

  const published = await prisma.scheduleVersion.findFirst({
    where: { routeServiceId, status: 'PUBLISHED' },
    orderBy: { publishedAt: 'desc' },
    include: {
      routeService: true,
      stops: { orderBy: { sequenceOrder: 'asc' }, include: { stop: true } },
    },
  });
  if (published) return res.json(published);

  // Return a clean default template schedule with VBIT College so all routes can be mapped immediately
  const route = await prisma.routeService.findUnique({ where: { id: routeServiceId } });
  if (!route) return res.status(404).json({ error: 'Route not found' });

  let vbitStop = await prisma.stop.findFirst({
    where: { name: { contains: 'VBIT', mode: 'insensitive' } },
  });
  if (!vbitStop) {
    vbitStop = await prisma.stop.create({
      data: { name: 'VBIT College', latitude: 17.4705, longitude: 78.7255 }
    });
  }

  return res.json({
    id: null,
    routeServiceId,
    name: `Route ${route.routeNo} Morning Schedule`,
    direction: 'MORNING',
    status: 'NEW_ROUTE',
    routeService: route,
    stops: [
      {
        id: null,
        sequenceOrder: 1,
        scheduledTime: '09:25',
        stop: vbitStop,
      },
    ],
  });
});

router.post('/route/:routeServiceId/save-stops', async (req, res) => {
  const routeServiceId = Number(req.params.routeServiceId);
  if (!Number.isInteger(routeServiceId)) return res.status(400).json({ error: 'Invalid routeServiceId' });

  const route = await prisma.routeService.findUnique({ where: { id: routeServiceId } });
  if (!route) return res.status(404).json({ error: 'Route not found' });

  const { name, direction = 'MORNING', stops: rawStops = [], publish = false } = req.body;

  if (!Array.isArray(rawStops) || rawStops.length < 2) {
    return res.status(400).json({ error: 'A route must have at least 2 stops (start pickup and college destination)' });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const resolvedStops = [];
      const usedStopIds = new Set();

      for (let i = 0; i < rawStops.length; i++) {
        const item = rawStops[i];
        let stopId = item.stopId ? Number(item.stopId) : null;
        const stopName = (item.name || `Stop ${i + 1}`).trim();
        const latitude = Number(Number(item.latitude || 17.44).toFixed(5));
        const longitude = Number(Number(item.longitude || 78.53).toFixed(5));

        let scheduledTime = '08:30';
        if (item.scheduledTime && typeof item.scheduledTime === 'string') {
          const match = item.scheduledTime.trim().match(/(\d{1,2}):(\d{2})/);
          if (match) {
            const h = Math.min(23, Math.max(0, parseInt(match[1], 10)));
            const m = Math.min(59, Math.max(0, parseInt(match[2], 10)));
            scheduledTime = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
          }
        } else if (i === rawStops.length - 1) {
          scheduledTime = '09:25';
        }

        // 1. If stopId was passed from frontend, verify it exists and is not already used in this schedule
        if (stopId && !Number.isNaN(stopId)) {
          if (usedStopIds.has(stopId)) {
            // Already claimed by an earlier stop in this schedule -> cannot reuse due to @@unique constraint!
            stopId = null;
          } else {
            const existingById = await tx.stop.findUnique({ where: { id: stopId } });
            if (existingById) {
              await tx.stop.update({
                where: { id: stopId },
                data: {
                  name: stopName,
                  latitude,
                  longitude,
                },
              });
            } else {
              stopId = null;
            }
          }
        }

        // 2. If no valid unique stopId, check if an existing stop matches BOTH name and exact location
        // AND is not already claimed in this schedule
        if (!stopId) {
          const existing = await tx.stop.findFirst({
            where: {
              name: stopName,
              latitude: { gte: latitude - 0.0002, lte: latitude + 0.0002 },
              longitude: { gte: longitude - 0.0002, lte: longitude + 0.0002 },
            },
          });

          if (existing && !usedStopIds.has(existing.id)) {
            stopId = existing.id;
          } else {
            // Create a brand new distinct stop entry
            const createdStop = await tx.stop.create({
              data: {
                name: stopName,
                latitude,
                longitude,
              },
            });
            stopId = createdStop.id;
          }
        }

        usedStopIds.add(stopId);

        resolvedStops.push({
          stopId,
          scheduledTime,
          sequenceOrder: i + 1,
        });
      }

      let schedule = await tx.scheduleVersion.findFirst({
        where: { routeServiceId, direction, status: 'DRAFT' },
        orderBy: { version: 'desc' },
      });

      if (!schedule) {
        const latest = await tx.scheduleVersion.findFirst({
          where: { routeServiceId, direction },
          orderBy: { version: 'desc' },
          select: { version: true },
        });
        schedule = await tx.scheduleVersion.create({
          data: {
            routeServiceId,
            direction,
            name: name || `${route.routeNo} Timetable`,
            version: (latest?.version || 0) + 1,
          },
        });
      } else if (name) {
        schedule = await tx.scheduleVersion.update({
          where: { id: schedule.id },
          data: { name },
        });
      }

      await tx.scheduleStop.deleteMany({ where: { scheduleVersionId: schedule.id } });
      for (const item of resolvedStops) {
        await tx.scheduleStop.create({
          data: {
            scheduleVersionId: schedule.id,
            stopId: item.stopId,
            sequenceOrder: item.sequenceOrder,
            scheduledTime: item.scheduledTime,
          },
        });
      }

      const stopsWithCoords = await tx.scheduleStop.findMany({
        where: { scheduleVersionId: schedule.id },
        orderBy: { sequenceOrder: 'asc' },
        include: { stop: true },
      });

      let geometry = null;
      if (stopsWithCoords.length >= 2) {
        try {
          geometry = await computeRealRoadGeometry(stopsWithCoords);
        } catch (geomErr) {
          console.warn('[save-stops] geometry generation error:', geomErr);
        }
      }

      if (publish) {
        await tx.scheduleVersion.updateMany({
          where: { routeServiceId, direction, status: 'PUBLISHED' },
          data: { status: 'ARCHIVED' },
        });

        schedule = await tx.scheduleVersion.update({
          where: { id: schedule.id },
          data: {
            status: 'PUBLISHED',
            publishedAt: new Date(),
            ...(geometry || {}),
          },
        });
      } else if (geometry) {
        schedule = await tx.scheduleVersion.update({
          where: { id: schedule.id },
          data: {
            ...(geometry || {}),
          },
        });
      }

      await writeAdminAudit(tx, req, {
        action: publish ? 'SCHEDULE_PUBLISHED' : 'SCHEDULE_UPDATED',
        entityType: 'ScheduleVersion',
        entityId: schedule.id,
        afterSummary: scheduleAuditSummary(schedule),
      });

      return tx.scheduleVersion.findUnique({
        where: { id: schedule.id },
        include: {
          routeService: true,
          stops: { orderBy: { sequenceOrder: 'asc' }, include: { stop: true } },
        },
      });
    });

    return res.json(result);
  } catch (error) {
    console.error('[schedules/save-stops]', error);
    return res.status(500).json({ error: error.message || 'Failed to save route stops' });
  }
});

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

router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid schedule ID' });

  const schedule = await prisma.scheduleVersion.findUnique({
    where: { id },
    include: {
      trips: { select: { id: true }, take: 1 },
      segmentSamples: { select: { id: true }, take: 1 },
      segmentAggregates: { select: { id: true }, take: 1 },
    },
  });
  if (!schedule) return res.status(404).json({ error: 'Schedule not found' });

  const hasLinkedHistory = schedule.trips.length > 0 || schedule.segmentSamples.length > 0 || schedule.segmentAggregates.length > 0;

  try {
    if (hasLinkedHistory) {
      await prisma.$transaction(async (tx) => {
        await tx.scheduleVersion.update({
          where: { id },
          data: { status: 'ARCHIVED' },
        });
        await writeAdminAudit(tx, req, {
          action: 'SCHEDULE_ARCHIVED',
          entityType: 'ScheduleVersion',
          entityId: id,
          beforeSummary: scheduleAuditSummary(schedule),
        });
      });
      return res.json({ deleted: true, archived: true, message: 'Schedule has historical trip logs and was archived.' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.scheduleStop.deleteMany({ where: { scheduleVersionId: id } });
      await tx.scheduleVersion.delete({ where: { id } });
      await writeAdminAudit(tx, req, {
        action: 'SCHEDULE_DELETED',
        entityType: 'ScheduleVersion',
        entityId: id,
        beforeSummary: scheduleAuditSummary(schedule),
      });
    });
    return res.json({ deleted: true, archived: false });
  } catch (error) {
    if (error.code === 'P2003') {
      await prisma.scheduleVersion.update({
        where: { id },
        data: { status: 'ARCHIVED' },
      });
      return res.json({ deleted: true, archived: true, message: 'Schedule was archived to preserve related data.' });
    }
    console.error('[schedules/delete]', error);
    return res.status(500).json({ error: 'Could not delete schedule' });
  }
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

  let geometry;
  try {
    geometry = await requestRouteGeometry(schedule.stops);
  } catch (error) {
    console.warn(`[schedules/publish] Google Maps geometry unavailable (${error.code || error.message}), using fallback interpolation.`);
    geometry = fallbackRouteGeometry(schedule.stops, error.code || 'GOOGLE_MAPS_UNAVAILABLE');
  }

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
      data: { status: 'PUBLISHED', publishedAt: new Date(), ...geometry },
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

router.post('/:id/geometry/regenerate', async (req, res) => {
  const id = Number(req.params.id);
  const schedule = await prisma.scheduleVersion.findUnique({
    where: { id },
    include: { stops: { orderBy: { sequenceOrder: 'asc' }, include: { stop: true } } },
  });
  if (!schedule) return res.status(404).json({ error: 'Schedule not found' });
  if (schedule.status !== 'PUBLISHED') {
    return res.status(409).json({ error: 'Only published route geometry can be regenerated' });
  }

  try {
    let geometry;
    try {
      geometry = await requestRouteGeometry(schedule.stops);
    } catch (error) {
      console.warn(`[schedules/regenerate] Google Maps geometry unavailable (${error.code || error.message}), using fallback interpolation.`);
      geometry = fallbackRouteGeometry(schedule.stops, error.code || 'GOOGLE_MAPS_UNAVAILABLE');
    }
    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.scheduleVersion.update({ where: { id }, data: geometry });
      await writeAdminAudit(tx, req, {
        action: 'ROUTE_GEOMETRY_REGENERATED',
        entityType: 'ScheduleVersion',
        entityId: id,
        beforeSummary: {
          fingerprint: schedule.geometryFingerprint,
          generatedAt: schedule.geometryGeneratedAt,
        },
        afterSummary: {
          fingerprint: result.geometryFingerprint,
          generatedAt: result.geometryGeneratedAt,
          provider: result.geometryProvider,
        },
      });
      return result;
    });
    return res.json(updated);
  } catch (error) {
    if (error instanceof GoogleMapsGeometryError) {
      await prisma.scheduleVersion.update({
        where: { id },
        data: { geometryErrorCode: error.code },
      });
      return res.status(error.statusCode).json({
        error: 'Route geometry could not be regenerated',
        code: error.code,
      });
    }
    console.error('[schedules/geometry-regenerate]', error);
    return res.status(500).json({ error: 'Route geometry could not be regenerated' });
  }
});

module.exports = router;
module.exports.validateSchedule = validateSchedule;
