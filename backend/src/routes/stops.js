const express = require('express');
const prisma = require('../lib/prisma');
const { crudRouter } = require('../crud');
const { stopSchema } = require('../schemas');
const { requireAuth } = require('../middleware/auth');
const { validate } = require('../crud');
const { writeAdminAudit } = require('../lib/adminAudit');
const { GoogleMapsGeometryError, requestRouteGeometry, fallbackRouteGeometry } = require('../lib/googleMapsGeometry');

const router = express.Router();

router.put('/:id/coordinates', requireAuth(['admin']), async (req, res) => {
  const id = Number(req.params.id);
  const data = validate(stopSchema.pick({ latitude: true, longitude: true }), req.body, res);
  if (!Number.isInteger(id) || id <= 0 || !data) return;
  const before = await prisma.stop.findUnique({ where: { id } });
  if (!before) return res.status(404).json({ error: 'Stop not found' });
  const schedules = await prisma.scheduleVersion.findMany({
    where: { status: 'PUBLISHED', stops: { some: { stopId: id } } },
    include: { stops: { orderBy: { sequenceOrder: 'asc' }, include: { stop: true } } },
  });
  const regenerated = [];
  for (const schedule of schedules) {
    const points = schedule.stops.map((entry) => entry.stopId === id
      ? { ...entry, stop: { ...entry.stop, ...data } }
      : entry);
    try {
      regenerated.push({ id: schedule.id, geometry: await requestRouteGeometry(points) });
    } catch (error) {
      console.warn(`[stops/coordinates] Google Maps geometry unavailable for schedule ${schedule.id} (${error.code || error.message}), using fallback interpolation.`);
      regenerated.push({ id: schedule.id, geometry: fallbackRouteGeometry(points, error.code || 'GOOGLE_MAPS_UNAVAILABLE') });
    }
  }
  try {
    const updated = await prisma.$transaction(async (tx) => {
      const stop = await tx.stop.update({ where: { id }, data });
      for (const item of regenerated) {
        await tx.scheduleVersion.update({ where: { id: item.id }, data: item.geometry });
        await writeAdminAudit(tx, req, {
          action: 'ROUTE_GEOMETRY_REGENERATED_AFTER_STOP_EDIT',
          entityType: 'ScheduleVersion', entityId: item.id,
          afterSummary: {
            fingerprint: item.geometry.geometryFingerprint,
            provider: item.geometry.geometryProvider,
            changedStopId: id,
          },
        });
      }
      await writeAdminAudit(tx, req, {
        action: 'STOP_COORDINATES_UPDATED', entityType: 'Stop', entityId: id,
        beforeSummary: { name: before.name, latitude: before.latitude, longitude: before.longitude },
        afterSummary: { name: stop.name, latitude: stop.latitude, longitude: stop.longitude, regeneratedSchedules: regenerated.length },
      });
      return stop;
    });
    return res.json({ stop: updated, regeneratedSchedules: regenerated.length });
  } catch (error) {
    console.error('[stops/coordinates]', error);
    return res.status(500).json({ error: 'Stop coordinates were not changed' });
  }
});

// publicGet: the student app needs to fetch stops without auth
const stopCrud = crudRouter({
  delegate: prisma.stop,
  createSchema: stopSchema,
  updateSchema: stopSchema.pick({ name: true }).partial(),
  publicGet: true,
  audit: {
    prisma,
    delegateName: 'stop',
    entityType: 'Stop',
    actions: { create: 'STOP_CREATED', update: 'STOP_UPDATED', delete: 'STOP_DELETED' },
    summarize: ({ name, latitude, longitude, geofenceRadiusM }) => ({
      name,
      latitude,
      longitude,
      geofenceRadiusM,
    }),
  },
});
router.use('/', stopCrud);

module.exports = router;
