const { randomUUID } = require('crypto');
const prisma = require('./prisma');
const { createNotificationProvider } = require('./notificationProvider');

const DEFAULT_BATCH_SIZE = 10;
const DEFAULT_INTERVAL_MS = 5000;
const DEFAULT_LOCK_TIMEOUT_MS = 2 * 60 * 1000;
const MAX_DELIVERY_ATTEMPTS = 5;
const RETRY_DELAYS_MS = [60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000, 6 * 60 * 60_000];

function retryDelayMs(attempts) {
  const index = Math.max(0, Math.min(RETRY_DELAYS_MS.length - 1, Number(attempts || 1) - 1));
  return RETRY_DELAYS_MS[index];
}

function safeDeliveryError(error) {
  const message = error instanceof Error ? error.message : String(error || 'Unknown provider error');
  return message.replace(/[\r\n\t]+/g, ' ').slice(0, 500);
}

function isPermanentDeliveryError(error) {
  if (error?.permanent === true) return true;
  const responseCode = Number(error?.responseCode);
  return Number.isInteger(responseCode) && responseCode >= 500 && responseCode <= 599;
}

async function claimNotificationBatch(client = prisma, options = {}) {
  const now = options.now || new Date();
  const batchSize = Math.min(100, Math.max(1, Number(options.batchSize || DEFAULT_BATCH_SIZE)));
  const lockTimeoutMs = Math.max(1000, Number(options.lockTimeoutMs || DEFAULT_LOCK_TIMEOUT_MS));
  const expiredBefore = new Date(now.getTime() - lockTimeoutMs);
  const lockToken = options.lockToken || randomUUID();

  return client.$transaction(async (tx) => {
    const rows = await tx.$queryRawUnsafe(
      `SELECT "id"
         FROM "NotificationOutbox"
        WHERE "status" = 'PENDING'
          AND "nextAttemptAt" <= $1
          AND ("lockedAt" IS NULL OR "lockedAt" < $2)
        ORDER BY "nextAttemptAt" ASC, "id" ASC
        FOR UPDATE SKIP LOCKED
        LIMIT $3`,
      now,
      expiredBefore,
      batchSize
    );
    const ids = rows.map((row) => Number(row.id)).filter(Number.isInteger);
    if (!ids.length) return { lockToken, items: [] };

    await tx.notificationOutbox.updateMany({
      where: { id: { in: ids } },
      data: { lockToken, lockedAt: now },
    });
    const items = await tx.notificationOutbox.findMany({
      where: { id: { in: ids }, lockToken },
      orderBy: { id: 'asc' },
    });
    return { lockToken, items };
  });
}

async function deliverClaimedNotification(client, provider, notification, options = {}) {
  const now = options.now || new Date();
  const maxAttempts = Math.max(1, Number(options.maxAttempts || MAX_DELIVERY_ATTEMPTS));
  const current = await client.notificationOutbox.findFirst({
    where: {
      id: notification.id,
      lockToken: notification.lockToken,
      status: 'PENDING',
    },
  });
  if (!current) return { outcome: 'LOST_CLAIM', id: notification.id };

  const attempts = current.attempts + 1;
  try {
    const result = await provider.sendEmail(current);
    const updated = await client.notificationOutbox.updateMany({
      where: { id: current.id, lockToken: current.lockToken, status: 'PENDING' },
      data: {
        status: 'SENT',
        attempts,
        lastAttemptAt: now,
        lastError: null,
        sentAt: now,
        providerMessageId: result?.messageId ? String(result.messageId).slice(0, 500) : null,
        lockToken: null,
        lockedAt: null,
      },
    });
    return updated.count === 1
      ? { outcome: 'SENT', id: current.id, attempts }
      : { outcome: 'LOST_CLAIM', id: current.id };
  } catch (error) {
    const permanent = isPermanentDeliveryError(error);
    const terminal = permanent || attempts >= maxAttempts;
    const nextAttemptAt = terminal ? current.nextAttemptAt : new Date(now.getTime() + retryDelayMs(attempts));
    const updated = await client.notificationOutbox.updateMany({
      where: { id: current.id, lockToken: current.lockToken, status: 'PENDING' },
      data: {
        status: terminal ? 'FAILED' : 'PENDING',
        attempts,
        lastAttemptAt: now,
        lastError: safeDeliveryError(error),
        nextAttemptAt,
        lockToken: null,
        lockedAt: null,
      },
    });
    if (updated.count !== 1) return { outcome: 'LOST_CLAIM', id: current.id };
    return {
      outcome: terminal ? 'FAILED' : 'RETRY_SCHEDULED',
      id: current.id,
      attempts,
      nextAttemptAt: terminal ? null : nextAttemptAt,
    };
  }
}

async function drainNotificationOutbox(options = {}) {
  const client = options.prisma || prisma;
  const provider = options.provider;
  if (!provider) return { claimed: 0, results: [] };
  const claim = await claimNotificationBatch(client, options);
  const results = [];
  for (const item of claim.items) {
    results.push(await deliverClaimedNotification(client, provider, item, options));
  }
  return { claimed: claim.items.length, results };
}

function setupNotificationOutboxWorker(options = {}) {
  const logger = options.logger || console;
  const provider = options.provider === undefined
    ? createNotificationProvider(process.env, logger)
    : options.provider;
  if (!provider) {
    logger.warn('[notification-worker] disabled; set NOTIFICATION_PROVIDER=console or smtp to enable delivery');
    return { enabled: false, runNow: async () => ({ claimed: 0, results: [] }), stop() {} };
  }

  const intervalMs = Math.max(1000, Number(options.intervalMs || process.env.NOTIFICATION_POLL_INTERVAL_MS || DEFAULT_INTERVAL_MS));
  let stopped = false;
  let running = false;
  const runNow = async () => {
    if (stopped || running) return { claimed: 0, results: [], skipped: true };
    running = true;
    try {
      return await drainNotificationOutbox({ ...options, provider });
    } catch (error) {
      logger.error(`[notification-worker] ${safeDeliveryError(error)}`);
      return { claimed: 0, results: [], error: safeDeliveryError(error) };
    } finally {
      running = false;
    }
  };
  const timer = setInterval(runNow, intervalMs);
  timer.unref?.();
  setImmediate(runNow);
  return {
    enabled: true,
    provider: provider.name || 'custom',
    runNow,
    stop() {
      stopped = true;
      clearInterval(timer);
    },
  };
}

module.exports = {
  DEFAULT_BATCH_SIZE,
  DEFAULT_INTERVAL_MS,
  DEFAULT_LOCK_TIMEOUT_MS,
  MAX_DELIVERY_ATTEMPTS,
  RETRY_DELAYS_MS,
  claimNotificationBatch,
  deliverClaimedNotification,
  drainNotificationOutbox,
  isPermanentDeliveryError,
  retryDelayMs,
  safeDeliveryError,
  setupNotificationOutboxWorker,
};
