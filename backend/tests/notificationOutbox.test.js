const test = require('node:test');
const assert = require('node:assert/strict');
const {
  MAX_DELIVERY_ATTEMPTS,
  RETRY_DELAYS_MS,
  deliverClaimedNotification,
  isPermanentDeliveryError,
  retryDelayMs,
  safeDeliveryError,
} = require('../src/lib/notificationOutbox');
const { buildEmailMessage, requiredSmtpConfig } = require('../src/lib/notificationProvider');
const { deriveMissingAdvisorGroups } = require('../src/lib/lateAlert');

function fakeClient(row) {
  return {
    row,
    notificationOutbox: {
      async findFirst({ where }) {
        if (where.id !== row.id || where.lockToken !== row.lockToken || row.status !== 'PENDING') return null;
        return { ...row };
      },
      async updateMany({ where, data }) {
        if (where.id !== row.id || where.lockToken !== row.lockToken || row.status !== 'PENDING') return { count: 0 };
        Object.assign(row, data);
        return { count: 1 };
      },
    },
  };
}

function claimedRow(overrides = {}) {
  return {
    id: 8,
    lateAlertId: 3,
    recipient: 'advisor@example.edu',
    channel: 'EMAIL',
    payload: {},
    status: 'PENDING',
    attempts: 0,
    idempotencyKey: 'late-alert-3-advisor-7',
    nextAttemptAt: new Date('2026-08-25T05:00:00.000Z'),
    lockToken: 'worker-claim',
    lockedAt: new Date('2026-08-25T05:00:00.000Z'),
    ...overrides,
  };
}

test('retry backoff grows and remains bounded', () => {
  assert.equal(retryDelayMs(1), RETRY_DELAYS_MS[0]);
  assert.equal(retryDelayMs(3), RETRY_DELAYS_MS[2]);
  assert.equal(retryDelayMs(100), RETRY_DELAYS_MS.at(-1));
});

test('provider errors distinguish retryable and permanent failures without unsafe log text', () => {
  assert.equal(isPermanentDeliveryError({ responseCode: 421 }), false);
  assert.equal(isPermanentDeliveryError({ responseCode: 550 }), true);
  assert.equal(isPermanentDeliveryError({ permanent: true }), true);
  assert.equal(safeDeliveryError(new Error('temporary\nserver\tfailure')).includes('\n'), false);
});

test('successful claimed notification is marked sent once with its provider message ID', async () => {
  const row = claimedRow();
  const client = fakeClient(row);
  let deliveries = 0;
  const result = await deliverClaimedNotification(
    client,
    { async sendEmail() { deliveries += 1; return { messageId: 'provider-123' }; } },
    row,
    { now: new Date('2026-08-25T05:01:00.000Z') }
  );
  assert.equal(deliveries, 1);
  assert.equal(result.outcome, 'SENT');
  assert.equal(row.status, 'SENT');
  assert.equal(row.attempts, 1);
  assert.equal(row.providerMessageId, 'provider-123');
  assert.equal(row.lockToken, null);

  const second = await deliverClaimedNotification(client, { async sendEmail() { deliveries += 1; } }, row);
  assert.equal(second.outcome, 'LOST_CLAIM');
  assert.equal(deliveries, 1);
});

test('transient failures are rescheduled and repeated failures become terminal', async () => {
  const now = new Date('2026-08-25T05:01:00.000Z');
  const transientRow = claimedRow();
  const transientResult = await deliverClaimedNotification(
    fakeClient(transientRow),
    { async sendEmail() { const error = new Error('mailbox busy'); error.responseCode = 421; throw error; } },
    transientRow,
    { now }
  );
  assert.equal(transientResult.outcome, 'RETRY_SCHEDULED');
  assert.equal(transientRow.status, 'PENDING');
  assert.equal(transientRow.nextAttemptAt.getTime(), now.getTime() + RETRY_DELAYS_MS[0]);

  const finalRow = claimedRow({ attempts: MAX_DELIVERY_ATTEMPTS - 1 });
  const finalResult = await deliverClaimedNotification(
    fakeClient(finalRow),
    { async sendEmail() { throw new Error('network still unavailable'); } },
    finalRow,
    { now }
  );
  assert.equal(finalResult.outcome, 'FAILED');
  assert.equal(finalRow.status, 'FAILED');
  assert.equal(finalRow.attempts, MAX_DELIVERY_ATTEMPTS);
});

test('permanent SMTP rejection fails immediately', async () => {
  const row = claimedRow();
  const result = await deliverClaimedNotification(
    fakeClient(row),
    { async sendEmail() { const error = new Error('recipient rejected'); error.responseCode = 550; throw error; } },
    row
  );
  assert.equal(result.outcome, 'FAILED');
  assert.equal(row.attempts, 1);
});

test('late-alert snapshot exposes class groups that have no advisor mapping', () => {
  const students = [
    { department: 'CSE', year: 2, section: 'A' },
    { department: 'CSE', year: 2, section: 'A' },
    { department: 'ECE', year: 3, section: 'B' },
  ];
  const advisors = [{ department: 'CSE', year: 2, section: 'A' }];
  assert.deepEqual(deriveMissingAdvisorGroups(students, advisors), [
    { department: 'ECE', year: 3, section: 'B' },
  ]);
});

test('email content is escaped and explicitly says the alert is not attendance', () => {
  const message = buildEmailMessage({
    payload: {
      advisorName: '<Advisor>',
      routeNo: '08',
      department: 'CSE',
      year: 2,
      section: 'A',
      predictedEta: '2026-08-25T04:30:00.000Z',
      students: [{ name: '<Student>', rollNo: '22CSE001' }],
    },
  });
  assert.match(message.subject, /Bus 08/);
  assert.match(message.text, /not a bus-attendance record/i);
  assert.doesNotMatch(message.html, /<Student>/);
  assert.match(message.html, /&lt;Student&gt;/);
});

test('SMTP configuration requires coherent credentials', () => {
  assert.throws(() => requiredSmtpConfig({ SMTP_PORT: '587' }), /SMTP_HOST/);
  assert.throws(
    () => requiredSmtpConfig({ SMTP_HOST: 'smtp.example.edu', SMTP_PORT: '587', SMTP_FROM: 'x@example.edu', SMTP_USER: 'x' }),
    /must either both be set/
  );
});
