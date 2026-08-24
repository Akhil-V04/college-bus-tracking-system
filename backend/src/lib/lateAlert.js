const prisma = require('./prisma');
const { estimateArrival } = require('./eta');
const { computeRecordHash } = require('./hashChain');

// ---- The "late" rule ----
// A bus is late if its predicted arrival at the campus (the final stop) is more
// than GRACE_MINUTES after that stop's scheduled time. When the schedule
// doesn't define a final-stop time, fall back to CAMPUS_DEADLINE (09:50 — every
// bus must reach the college by then).
const GRACE_MINUTES = 10;
const CAMPUS_DEADLINE = '09:50';
// Don't re-alert the same trip within this window (prevents alert spam).
const DUPLICATE_WINDOW_MS = 30 * 60 * 1000;

function minutesOfDay(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm));
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

function minutesToDate(min) {
  const d = new Date();
  d.setHours(Math.floor(min / 60), min % 60, 0, 0);
  return d;
}

// Evaluates a single trip against the late rule. Returns the assessment plus
// enough context for triggerAlert to build the alert row.
async function evaluateTrip(tripId) {
  const eta = await estimateArrival(tripId);
  if (!eta) return { exists: false };

  const trip = await prisma.trip.findUnique({ where: { id: tripId } });
  if (!trip || trip.status !== 'RUNNING') return { exists: true, running: false };

  const stops = eta.stops;
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();

  let deadline = minutesOfDay(CAMPUS_DEADLINE);
  if (stops.length > 0) {
    deadline = minutesOfDay(stops[stops.length - 1].scheduledTime) ?? deadline;
  }

  let arrivalMin = null;
  if (stops.length > 0) {
    const finalEta = stops[stops.length - 1].etaMinutes;
    if (finalEta != null) arrivalMin = nowMin + finalEta;
  } else if (eta.atDestination) {
    // Bus has passed the last stop but the trip is still RUNNING — it should
    // already be at the destination.
    arrivalMin = nowMin;
  }

  if (arrivalMin == null) {
    return { exists: true, running: true, late: false, reason: 'insufficient-data' };
  }

  const minutesLate = arrivalMin - deadline;
  return {
    exists: true,
    running: true,
    late: minutesLate > GRACE_MINUTES,
    minutesLate,
    deadline,
    predictedArrival: minutesToDate(arrivalMin),
    currentStopIndex: eta.currentStopIndex,
    atDestination: eta.atDestination,
  };
}

// Evaluates a trip and, if it is late, appends a new LateAlert to the hash
// chain. Returns the created alert (or null when not late / already alerted).
async function triggerAlert(tripId) {
  const evalResult = await evaluateTrip(tripId);
  if (!evalResult.exists || !evalResult.running || !evalResult.late) return null;

  // Deduplicate — don't spam the same trip within the window.
  const recent = await prisma.lateAlert.findFirst({
    where: { tripId, triggeredAt: { gte: new Date(Date.now() - DUPLICATE_WINDOW_MS) } },
  });
  if (recent) return null;

  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: { bus: { include: { route: true } } },
  });
  if (!trip) return null;

  const students = await prisma.student.findMany({
    where: { routeId: trip.bus.routeId },
    include: { boardingStop: true },
  });

  const studentsAffected = students.map((s) => ({
    rollNo: s.rollNo,
    name: s.name,
    email: s.email,
    boardingStopId: s.boardingStopId,
    boardingStop: s.boardingStop.name,
  }));

  // Notify the class advisor of every affected class (year + department + section).
  const classes = [...new Set(students.map((s) => `${s.year}|${s.department}|${s.section}`))];
  const advisorsNotified = [];
  for (const cls of classes) {
    const [year, department, section] = cls.split('|');
    const advisor = await prisma.classAdvisor.findFirst({
      where: { year: Number(year), department, section },
    });
    if (advisor) {
      advisorsNotified.push({
        id: advisor.id,
        name: advisor.name,
        email: advisor.email,
        department: advisor.department,
        year: advisor.year,
        section: advisor.section,
      });
    }
  }

  const previous = await prisma.lateAlert.findFirst({ orderBy: { id: 'desc' } });
  const previousHash = previous ? previous.recordHash : null;

  const triggeredAt = new Date();
  const data = {
    tripId,
    predictedEta: evalResult.predictedArrival,
    triggeredAt,
    studentsAffected,
    advisorsNotified,
    previousHash,
  };
  const recordHash = computeRecordHash(data);

  return prisma.lateAlert.create({
    data: {
      tripId,
      predictedEta: data.predictedEta,
      studentsAffected,
      advisorsNotified,
      previousHash,
      recordHash,
    },
  });
}

// Runs triggerAlert for every RUNNING trip. Returns the ids of alerts created.
async function checkAllTrips() {
  const trips = await prisma.trip.findMany({
    where: { status: 'RUNNING' },
    select: { id: true },
  });
  const triggered = [];
  for (const t of trips) {
    const alert = await triggerAlert(t.id);
    if (alert) triggered.push(alert.id);
  }
  return triggered;
}

module.exports = { evaluateTrip, triggerAlert, checkAllTrips };
