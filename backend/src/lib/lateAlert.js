const prisma = require('./prisma');
const { computeRecordHash, alertHashData } = require('./hashChain');

const REQUIRED_CONSECUTIVE_EVALUATIONS = 3;
const EVALUATION_THROTTLE_MS = 30 * 1000;
const stateByTrip = new Map();

function getZonedParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  return Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, Number(part.value)]));
}

function timeZoneOffsetMs(date, timeZone) {
  const parts = getZonedParts(date, timeZone);
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) - date.getTime();
}

function deadlineForToday(now = new Date()) {
  const timeZone = process.env.APP_TIMEZONE || 'Asia/Kolkata';
  const [hour, minute] = (process.env.COLLEGE_ARRIVAL_DEADLINE || '09:50').split(':').map(Number);
  const local = getZonedParts(now, timeZone);
  const utcGuess = new Date(Date.UTC(local.year, local.month - 1, local.day, hour, minute, 0));
  return new Date(utcGuess.getTime() - timeZoneOffsetMs(utcGuess, timeZone));
}

async function createLateAlert(tripId, predictedEta) {
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    select: { id: true, rosterId: true, routeServiceId: true },
  });
  if (!trip) return null;

  const students = await prisma.rosterPassenger.findMany({
    where: {
      rosterId: trip.rosterId,
      routeServiceId: trip.routeServiceId,
      passengerType: 'STUDENT',
    },
    select: {
      name: true,
      rollNo: true,
      department: true,
      year: true,
      section: true,
      boardingStopId: true,
    },
    orderBy: { rollNo: 'asc' },
  });

  const classKeys = [...new Set(students.map((student) => `${student.department}|${student.year}|${student.section}`))];
  const advisors = [];
  for (const key of classKeys) {
    const [department, year, section] = key.split('|');
    const advisor = await prisma.classAdvisor.findFirst({
      where: { department, year: Number(year), section },
      select: { id: true, name: true, email: true, department: true, year: true, section: true },
    });
    if (advisor) advisors.push(advisor);
  }

  return prisma.$transaction(
    async (tx) => {
      const existing = await tx.lateAlert.findFirst({
        where: { tripId, status: 'ACTIVE' },
        select: { id: true },
      });
      if (existing) return null;

      const previous = await tx.lateAlert.findFirst({
        where: { recordHash: { not: null } },
        orderBy: { id: 'desc' },
        select: { recordHash: true },
      });
      const triggeredAt = new Date();
      const immutable = {
        tripId,
        predictedEta,
        triggeredAt,
        studentsAffected: students,
        advisorsNotified: advisors,
        previousHash: previous?.recordHash || null,
      };
      const alert = await tx.lateAlert.create({
        data: {
          ...immutable,
          recordHash: computeRecordHash(alertHashData(immutable)),
        },
      });
      if (advisors.length) {
        await tx.notificationOutbox.createMany({
          data: advisors.map((advisor) => ({
            lateAlertId: alert.id,
            recipient: advisor.email,
            payload: {
              advisorName: advisor.name,
              department: advisor.department,
              year: advisor.year,
              section: advisor.section,
              predictedEta,
              students: students.filter(
                (student) =>
                  student.department === advisor.department &&
                  student.year === advisor.year &&
                  student.section === advisor.section
              ),
            },
          })),
        });
      }
      return alert;
    },
    { isolationLevel: 'Serializable' }
  );
}

async function observeTripEta(tripId, eta) {
  const now = Date.now();
  const state = stateByTrip.get(tripId) || { lastCheckedAt: 0, lateCount: 0, onTimeCount: 0 };
  if (now - state.lastCheckedAt < EVALUATION_THROTTLE_MS) return null;
  state.lastCheckedAt = now;

  const finalStop = Array.isArray(eta?.stops) ? eta.stops[eta.stops.length - 1] : null;
  if (!finalStop || finalStop.etaMinutes == null || eta.confidence === 'LOW') {
    stateByTrip.set(tripId, state);
    return null;
  }

  const predictedEta = new Date(now + finalStop.etaMinutes * 60 * 1000);
  const late = predictedEta > deadlineForToday(new Date(now));
  state.lateCount = late ? state.lateCount + 1 : 0;
  state.onTimeCount = late ? 0 : state.onTimeCount + 1;
  stateByTrip.set(tripId, state);

  if (late && state.lateCount >= REQUIRED_CONSECUTIVE_EVALUATIONS) {
    return createLateAlert(tripId, predictedEta);
  }
  if (!late && state.onTimeCount >= REQUIRED_CONSECUTIVE_EVALUATIONS) {
    await prisma.lateAlert.updateMany({
      where: { tripId, status: 'ACTIVE' },
      data: { status: 'RECOVERED', recoveredAt: new Date(now) },
    });
  }
  return null;
}

function clearTripObservation(tripId) {
  stateByTrip.delete(tripId);
}

module.exports = {
  deadlineForToday,
  createLateAlert,
  observeTripEta,
  clearTripObservation,
  REQUIRED_CONSECUTIVE_EVALUATIONS,
  EVALUATION_THROTTLE_MS,
};
