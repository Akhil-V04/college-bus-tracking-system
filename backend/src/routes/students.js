const express = require('express');
const prisma = require('../lib/prisma');
const { crudRouter } = require('../crud');
const { requireAuth } = require('../middleware/auth');
const { studentSchema } = require('../schemas');

const router = express.Router();

// GET /students/me — the logged-in student's full profile including route and
// boarding stop. Uses the JWT (requireAuth with student role).
router.get('/me', requireAuth(['student']), async (req, res) => {
  try {
    const student = await prisma.student.findUnique({
      where: { id: req.user.id },
      include: {
        route: { include: { routeStops: { orderBy: { sequenceOrder: 'asc' }, include: { stop: true } } } },
        boardingStop: true,
      },
    });
    if (!student) return res.status(404).json({ error: 'Student not found' });
    res.json(student);
  } catch (err) {
    console.error('students me error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /students/by-route/:routeId — public-ish; student/advisor apps need this.
// Returns students on a route (minus any sensitive fields).
router.get('/by-route/:routeId', async (req, res) => {
  try {
    const routeId = parseInt(req.params.routeId, 10);
    if (Number.isNaN(routeId)) return res.status(400).json({ error: 'Invalid routeId' });
    const students = await prisma.student.findMany({
      where: { routeId },
      select: {
        id: true,
        rollNo: true,
        name: true,
        email: true,
        year: true,
        department: true,
        section: true,
        routeId: true,
        boardingStopId: true,
        googleId: true,
      },
      orderBy: { rollNo: 'asc' },
    });
    res.json(students);
  } catch (err) {
    console.error('students by-route error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const studentCrud = crudRouter({
  delegate: prisma.student,
  createSchema: studentSchema,
  updateSchema: studentSchema.partial(),
  include: { boardingStop: true },
});
router.use('/', studentCrud);

module.exports = router;