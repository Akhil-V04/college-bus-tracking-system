const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');
const { estimateArrival } = require('../lib/eta');

const router = express.Router();

// POST /trips/start — { busId } — create a RUNNING trip for today.
router.post('/start', requireAuth(['driver', 'admin']), async (req, res) => {
  try {
    const { busId } = req.body || {};
    if (!busId) return res.status(400).json({ error: 'busId is required' });

    const bus = await prisma.bus.findUnique({ where: { id: Number(busId) } });
    if (!bus) return res.status(404).json({ error: 'Bus not found' });

    // Close any previous RUNNING trip for this bus (defensive).
    await prisma.trip.updateMany({
      where: { busId: bus.id, status: 'RUNNING' },
      data: { status: 'COMPLETED' },
    });

    const trip = await prisma.trip.create({
      data: {
        busId: bus.id,
        date: new Date(),
        startTime: new Date(),
        status: 'RUNNING',
        filledCount: 0,
      },
    });

    res.status(201).json({ tripId: trip.id });
  } catch (err) {
    console.error('[trips/start]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /trips/:id/end — mark the trip COMPLETED.
router.post('/:id/end', requireAuth(['driver', 'admin']), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const trip = await prisma.trip.update({
      where: { id },
      data: { status: 'COMPLETED' },
    });
    res.json({ tripId: trip.id, status: trip.status });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Trip not found' });
    console.error('[trips/:id/end]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /trips/:id/board — { rollNo } — driver QR scan.
router.post('/:id/board', requireAuth(['driver', 'admin']), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { rollNo } = req.body || {};
    if (!rollNo) return res.status(400).json({ error: 'rollNo is required' });

    const trip = await prisma.trip.findUnique({
      where: { id },
      include: { bus: { include: { route: true } } },
    });
    if (!trip) return res.status(404).json({ error: 'Trip not found' });

    const student = await prisma.student.findUnique({ where: { rollNo } });
    if (!student) return res.status(404).json({ error: `No student found with rollNo ${rollNo}` });

    if (student.routeId !== trip.bus.routeId) {
      return res.status(404).json({
        error: `Student ${rollNo} is not on route ${trip.bus.route.routeNo} — they board a different bus`,
      });
    }

    const existing = await prisma.boardingRecord.findUnique({
      where: { tripId_studentId: { tripId: trip.id, studentId: student.id } },
    });
    if (existing) {
      return res.status(409).json({
        error: `Student ${rollNo} (${student.name}) already boarded this trip`,
      });
    }

    await prisma.boardingRecord.create({
      data: { tripId: trip.id, studentId: student.id },
    });

    const updated = await prisma.trip.update({
      where: { id: trip.id },
      data: { filledCount: { increment: 1 } },
    });

    // Notify the trip room that occupancy changed.
    const io = req.app.get('io');
    if (io) {
      io.to(`trip:${trip.id}`).emit('occupancy:update', {
        tripId: trip.id,
        filledCount: updated.filledCount,
        lastBoarded: { rollNo: student.rollNo, name: student.name },
      });
    }

    res.status(201).json({
      boarded: true,
      rollNo: student.rollNo,
      name: student.name,
      filledCount: updated.filledCount,
    });
  } catch (err) {
    console.error('[trips/:id/board]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /trips/:id/eta — arrival-time prediction for each remaining stop (public).
router.get('/:id/eta', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const eta = await estimateArrival(id);
    if (!eta) return res.status(404).json({ error: 'Trip not found' });
    res.json(eta);
  } catch (err) {
    console.error('[trips/:id/eta]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /trips/active — all RUNNING trips with route + latest location (public).
router.get('/active', async (req, res) => {
  try {
    const trips = await prisma.trip.findMany({
      where: { status: 'RUNNING' },
      include: {
        bus: {
          include: {
            route: true,
            driver: { select: { id: true, name: true, phone: true } },
          },
        },
      },
      orderBy: { startTime: 'asc' },
    });

    const tripsWithLocation = await Promise.all(
      trips.map(async (trip) => {
        const latest = await prisma.liveLocation.findFirst({
          where: { tripId: trip.id },
          orderBy: { timestamp: 'desc' },
        });
        return {
          tripId: trip.id,
          date: trip.date,
          startTime: trip.startTime,
          status: trip.status,
          filledCount: trip.filledCount,
          route: trip.bus.route,
          driver: trip.bus.driver,
          bus: { id: trip.bus.id, busNo: trip.bus.busNo, capacity: trip.bus.capacity, plateNumber: trip.bus.plateNumber },
          latestLocation: latest
            ? {
                latitude: latest.latitude,
                longitude: latest.longitude,
                currentStopIndex: latest.currentStopIndex,
                timestamp: latest.timestamp,
              }
            : null,
        };
      })
    );

    res.json(tripsWithLocation);
  } catch (err) {
    console.error('[trips/active]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;