const prisma = require('./prisma');
const { computeRecordHash, alertHashData } = require('./hashChain');

const REQUIRED_CONSECUTIVE_EVALUATIONS = 3;
const EVALUATION_THROTTLE_MS = 30 * 1000;
const ALERT_TRANSACTION_RETRIES = 3;
const ALERT_HASH_CHAIN_LOCK_ID = 753421;
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

function classGroupKey(value) {
  return `${value?.department || ''}|${Number(value?.year) || ''}|${value?.section || ''}`;
}

function deriveMissingAdvisorGroups(students = [], advisors = []) {
  const notifiedKeys = new Set(advisors.map(classGroupKey));
  const missing = new Map();
  for (const student of students) {
    const key = classGroupKey(student);
    if (!notifiedKeys.has(key) && !missing.has(key)) {
      missing.set(key, {
        department: student.department,
        year: student.year,
        section: student.section,
      });
    }
  }
  return [...missing.values()].sort((a, b) => classGroupKey(a).localeCompare(classGroupKey(b)));
}

async function createLateAlert(tripId, predictedEta) {
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    select: {
      id: true,
      rosterId: true,
      routeServiceId: true,
      rosterSnapshot: true,
      routeSnapshot: true,
      routeService: { select: { routeNo: true, name: true } },
    },
  });
  if (!trip) return null;

  const snapshottedStudents = Array.isArray(trip.rosterSnapshot?.students)
    ? trip.rosterSnapshot.students
    : null;
  const students = snapshottedStudents || await prisma.rosterPassenger.findMany({
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

  const classKeys = [...new Set(students.map(classGroupKey))];
  const advisors = [];
  for (const key of classKeys) {
    const [department, year, section] = key.split('|');
    const advisor = await prisma.classAdvisor.findFirst({
      where: { department, year: Number(year), section },
      select: { id: true, name: true, email: true, department: true, year: true, section: true },
    });
    if (advisor) advisors.push(advisor);
  }

  for (let attempt = 1; attempt <= ALERT_TRANSACTION_RETRIES; attempt += 1) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          // One global advisory lock keeps the immutable hash chain linear when
          // multiple backend processes create alerts at the same moment.
          await tx.$queryRawUnsafe(
            'SELECT 1::int AS locked FROM (SELECT pg_advisory_xact_lock($1)) AS acquired',
            ALERT_HASH_CHAIN_LOCK_ID
          );
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
                idempotencyKey: `late-alert-${alert.id}-advisor-${advisor.id}`,
                payload: {
                  advisorName: advisor.name,
                  department: advisor.department,
                  year: advisor.year,
                  section: advisor.section,
                  routeNo: trip.routeSnapshot?.routeNo || trip.routeService.routeNo,
                  routeName: trip.routeSnapshot?.name || trip.routeService.name,
                  predictedEta,
                  students: students.filter((student) => classGroupKey(student) === classGroupKey(advisor)),
                },
              })),
            });
          }
          return alert;
        },
        { isolationLevel: 'Serializable' }
      );
    } catch (error) {
      if (error?.code === 'P2002') return null;
      if (error?.code === 'P2034' && attempt < ALERT_TRANSACTION_RETRIES) continue;
      throw error;
    }
  }
  return null;
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
  ALERT_HASH_CHAIN_LOCK_ID,
  ALERT_TRANSACTION_RETRIES,
  EVALUATION_THROTTLE_MS,
  REQUIRED_CONSECUTIVE_EVALUATIONS,
  classGroupKey,
  clearTripObservation,
  createLateAlert,
  deadlineForToday,
  deriveMissingAdvisorGroups,
  observeTripEta,
};
