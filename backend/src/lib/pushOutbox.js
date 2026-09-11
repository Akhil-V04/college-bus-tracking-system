const { randomUUID } = require('crypto');
const prisma = require('./prisma');
const { createPushProvider } = require('./pushProvider');

const RETRY_DELAYS_MS = [60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000];

async function enqueueDriverPush(driverId, idempotencyKey, payload, client = prisma) {
  const devices = await client.pushDeviceSubscription.findMany({
    where: {
      driverId, active: true,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    select: { id: true },
  });
  if (!devices.length) return 0;
  const result = await client.pushNotificationOutbox.createMany({
    data: devices.map((device) => ({
      pushDeviceSubscriptionId: device.id,
      idempotencyKey: `${idempotencyKey}:device:${device.id}`,
      payload,
    })),
    skipDuplicates: true,
  });
  return result.count;
}

async function drainPushOutbox(options = {}) {
  const client = options.prisma || prisma;
  const provider = options.provider === undefined ? createPushProvider(process.env) : options.provider;
  if (!provider) return { claimed: 0, sent: 0 };
  const candidates = await client.pushNotificationOutbox.findMany({
    where: { status: 'PENDING', nextAttemptAt: { lte: new Date() }, providerReceiptId: null },
    orderBy: [{ nextAttemptAt: 'asc' }, { id: 'asc' }],
    take: Math.min(100, Number(options.batchSize || 20)),
    select: {
      id: true, payload: true, attempts: true,
      device: { select: { id: true, pushToken: true, active: true } },
    },
  });
  let claimed = 0;
  let sent = 0;
  for (const candidate of candidates) {
    const claimToken = `claim:${randomUUID()}`;
    const claim = await client.pushNotificationOutbox.updateMany({
      where: { id: candidate.id, status: 'PENDING', providerReceiptId: null },
      data: { providerReceiptId: claimToken, attempts: { increment: 1 }, lastAttemptAt: new Date() },
    });
    if (!claim.count) continue;
    claimed += 1;
    try {
      if (!candidate.device.active) throw Object.assign(new Error('DEVICE_INACTIVE'), { permanent: true });
      const result = await provider.send(candidate);
      await client.pushNotificationOutbox.update({
        where: { id: candidate.id },
        data: { status: 'SENT', sentAt: new Date(), lastError: null, providerReceiptId: result.receiptId },
      });
      if (Number.isInteger(candidate.payload?.deliveryId)) {
        await client.stopAlertDelivery.updateMany({
          where: { id: candidate.payload.deliveryId, status: 'PENDING' }, data: { status: 'SENT', sentAt: new Date() },
        });
      }
      sent += 1;
    } catch (error) {
      const attempts = candidate.attempts + 1;
      const terminal = error.permanent === true || attempts >= 5;
      await client.$transaction(async (tx) => {
        await tx.pushNotificationOutbox.update({
          where: { id: candidate.id },
          data: {
            status: terminal ? 'FAILED' : 'PENDING',
            lastError: String(error.code || 'PUSH_DELIVERY_FAILED').replace(/[^A-Z0-9_-]/gi, '_').slice(0, 100),
            providerReceiptId: null,
            nextAttemptAt: terminal ? new Date() : new Date(Date.now() + RETRY_DELAYS_MS[Math.min(attempts - 1, RETRY_DELAYS_MS.length - 1)]),
          },
        });
        if (error.invalidToken) {
          await tx.pushDeviceSubscription.update({ where: { id: candidate.device.id }, data: { active: false } });
        }
        if (terminal && Number.isInteger(candidate.payload?.deliveryId)) {
          await tx.stopAlertDelivery.updateMany({
            where: { id: candidate.payload.deliveryId, status: 'PENDING' }, data: { status: 'FAILED' },
          });
        }
      });
    }
  }
  return { claimed, sent };
}

async function checkPushReceipts(options = {}) {
  const client = options.prisma || prisma;
  const provider = options.provider === undefined ? createPushProvider(process.env) : options.provider;
  if (!provider?.checkReceipts) return { checked: 0, failed: 0, deactivated: 0 };
  const items = await client.pushNotificationOutbox.findMany({
    where: {
      status: 'SENT', sentAt: { lte: new Date(Date.now() - 15 * 60_000) },
      providerReceiptId: { not: null, notIn: [] },
      NOT: [{ providerReceiptId: { startsWith: 'checked:' } }, { providerReceiptId: { startsWith: 'simulated:' } }],
    },
    select: { id: true, providerReceiptId: true, pushDeviceSubscriptionId: true },
    take: 1000,
  });
  if (!items.length) return { checked: 0, failed: 0, deactivated: 0 };
  const receipts = await provider.checkReceipts(items.map((item) => item.providerReceiptId));
  let checked = 0;
  let failed = 0;
  let deactivated = 0;
  for (const item of items) {
    const receipt = receipts[item.providerReceiptId];
    if (!receipt) continue;
    const providerCode = String(receipt.details?.error || 'EXPO_RECEIPT_ERROR').toUpperCase();
    const invalidToken = providerCode === 'DEVICENOTREGISTERED';
    await client.$transaction(async (tx) => {
      await tx.pushNotificationOutbox.update({
        where: { id: item.id },
        data: receipt.status === 'ok'
          ? { providerReceiptId: `checked:${item.providerReceiptId}`, lastError: null }
          : { status: 'FAILED', providerReceiptId: `checked:${item.providerReceiptId}`, lastError: providerCode.slice(0, 100) },
      });
      if (invalidToken) {
        await tx.pushDeviceSubscription.update({
          where: { id: item.pushDeviceSubscriptionId }, data: { active: false },
        });
      }
    });
    checked += 1;
    if (receipt.status !== 'ok') failed += 1;
    if (invalidToken) deactivated += 1;
  }
  return { checked, failed, deactivated };
}

function setupPushOutboxWorker(options = {}) {
  const intervalMs = Math.max(1000, Number(options.intervalMs || 5000));
  let running = false;
  const runNow = async () => {
    if (running) return { claimed: 0, sent: 0, skipped: true };
    running = true;
    try {
      const delivery = await drainPushOutbox(options);
      const receipts = await checkPushReceipts(options);
      return { ...delivery, receipts };
    }
    catch (error) {
      (options.logger || console).error('[push-worker] delivery cycle failed');
      return { claimed: 0, sent: 0, error: 'DELIVERY_CYCLE_FAILED' };
    } finally { running = false; }
  };
  const timer = setInterval(runNow, intervalMs);
  timer.unref?.();
  setImmediate(runNow);
  return { runNow, stop: () => clearInterval(timer) };
}

module.exports = { RETRY_DELAYS_MS, checkPushReceipts, drainPushOutbox, enqueueDriverPush, setupPushOutboxWorker };
