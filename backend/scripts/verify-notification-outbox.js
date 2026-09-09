require('dotenv').config();

const assert = require('node:assert/strict');
const { PrismaClient } = require('@prisma/client');
const {
  claimNotificationBatch,
  deliverClaimedNotification,
} = require('../src/lib/notificationOutbox');

const prisma = new PrismaClient();
const suffix = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
const created = {};

async function createFixture() {
  created.driver = await prisma.driver.create({
    data: {
      driverCode: `OUTBOX-${suffix}`,
      name: 'Outbox Test Driver',
      phone: `9${String(Date.now()).slice(-9)}`,
      licenseNo: `OUTBOX-${suffix}`,
      passwordHash: 'integration-test-only',
    },
  });
  created.route = await prisma.routeService.create({
    data: {
      routeNo: `OUTBOX-${suffix}`,
      name: 'Outbox Integration Route',
      areaCovered: 'Temporary integration fixture',
      capacity: 10,
      driverId: created.driver.id,
    },
  });
  created.schedule = await prisma.scheduleVersion.create({
    data: {
      routeServiceId: created.route.id,
      name: 'Outbox Integration Schedule',
      version: 1,
      status: 'PUBLISHED',
    },
  });
  created.roster = await prisma.transportRoster.create({
    data: {
      name: 'Outbox Integration Roster',
      academicYear: `OUTBOX-${suffix}`,
      version: 1,
      status: 'PUBLISHED',
    },
  });
  created.trip = await prisma.trip.create({
    data: {
      routeServiceId: created.route.id,
      driverId: created.driver.id,
      rosterId: created.roster.id,
      scheduleVersionId: created.schedule.id,
      date: new Date(),
      status: 'COMPLETED',
    },
  });
  created.alert = await prisma.lateAlert.create({
    data: {
      tripId: created.trip.id,
      predictedEta: new Date(Date.now() + 30 * 60 * 1000),
      status: 'RECOVERED',
      studentsAffected: [],
      advisorsNotified: [],
    },
  });
}

async function createNotification(label) {
  return prisma.notificationOutbox.create({
    data: {
      lateAlertId: created.alert.id,
      recipient: `${label}@example.edu`,
      idempotencyKey: `outbox-integration-${suffix}-${label}`,
      payload: { advisorName: 'Integration Advisor', routeNo: created.route.routeNo, students: [] },
    },
  });
}

async function run() {
  await createFixture();

  const first = await createNotification('concurrency');
  const now = new Date();
  const [workerA, workerB] = await Promise.all([
    claimNotificationBatch(prisma, { now, batchSize: 1, lockToken: `worker-a-${suffix}` }),
    claimNotificationBatch(prisma, { now, batchSize: 1, lockToken: `worker-b-${suffix}` }),
  ]);
  assert.equal(workerA.items.length + workerB.items.length, 1, 'exactly one worker must claim the row');
  const winningClaim = workerA.items[0] || workerB.items[0];
  assert.equal(winningClaim.id, first.id);
  const sent = await deliverClaimedNotification(
    prisma,
    { async sendEmail(item) { return { messageId: `integration:${item.idempotencyKey}` }; } },
    winningClaim,
    { now: new Date(now.getTime() + 1000) }
  );
  assert.equal(sent.outcome, 'SENT');

  const retryable = await createNotification('retry');
  const retryClaim = await claimNotificationBatch(prisma, {
    now: new Date(now.getTime() + 2000),
    batchSize: 1,
    lockToken: `worker-retry-${suffix}`,
  });
  assert.equal(retryClaim.items[0].id, retryable.id);
  const scheduled = await deliverClaimedNotification(
    prisma,
    { async sendEmail() { const error = new Error('temporary outage'); error.responseCode = 421; throw error; } },
    retryClaim.items[0],
    { now: new Date(now.getTime() + 3000) }
  );
  assert.equal(scheduled.outcome, 'RETRY_SCHEDULED');
  await prisma.notificationOutbox.update({
    where: { id: retryable.id },
    data: { nextAttemptAt: new Date(now.getTime() + 3000) },
  });
  const recoveredClaim = await claimNotificationBatch(prisma, {
    now: new Date(now.getTime() + 4000),
    batchSize: 1,
    lockToken: `worker-recovered-${suffix}`,
  });
  const recovered = await deliverClaimedNotification(
    prisma,
    { async sendEmail(item) { return { messageId: `integration:${item.idempotencyKey}` }; } },
    recoveredClaim.items[0],
    { now: new Date(now.getTime() + 5000) }
  );
  assert.equal(recovered.outcome, 'SENT');

  const stale = await createNotification('stale-lock');
  await prisma.notificationOutbox.update({
    where: { id: stale.id },
    data: { lockToken: `dead-worker-${suffix}`, lockedAt: new Date(now.getTime() - 10 * 60 * 1000) },
  });
  const reclaimed = await claimNotificationBatch(prisma, {
    now: new Date(now.getTime() + 10_000),
    batchSize: 1,
    lockTimeoutMs: 2 * 60 * 1000,
    lockToken: `replacement-worker-${suffix}`,
  });
  assert.equal(reclaimed.items[0].id, stale.id);

  await assert.rejects(
    () => prisma.notificationOutbox.create({
      data: {
        lateAlertId: created.alert.id,
        recipient: 'duplicate@example.edu',
        idempotencyKey: first.idempotencyKey,
        payload: {},
      },
    }),
    (error) => error?.code === 'P2002'
  );

  const rows = await prisma.notificationOutbox.findMany({
    where: { lateAlertId: created.alert.id },
    orderBy: { id: 'asc' },
    select: { status: true, attempts: true, lockToken: true },
  });
  assert.deepEqual(rows.map((row) => row.status), ['SENT', 'SENT', 'PENDING']);
  assert.deepEqual(rows.map((row) => row.attempts), [1, 2, 0]);
  console.log(JSON.stringify({
    concurrentClaims: [workerA.items.length, workerB.items.length],
    retryRecovered: recovered.outcome,
    staleLockReclaimed: reclaimed.items.length === 1,
    idempotencyConstraint: 'verified',
  }));
}

async function cleanup() {
  if (created.alert) await prisma.lateAlert.deleteMany({ where: { id: created.alert.id } });
  if (created.trip) await prisma.trip.deleteMany({ where: { id: created.trip.id } });
  if (created.schedule) await prisma.scheduleVersion.deleteMany({ where: { id: created.schedule.id } });
  if (created.roster) await prisma.transportRoster.deleteMany({ where: { id: created.roster.id } });
  if (created.route) await prisma.routeService.deleteMany({ where: { id: created.route.id } });
  if (created.driver) await prisma.driver.deleteMany({ where: { id: created.driver.id } });
}

run()
  .finally(async () => {
    await cleanup();
    await prisma.$disconnect();
  });
