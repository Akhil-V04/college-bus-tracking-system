const SENSITIVE_KEY = /(password|hash|phone|license|email|recipient|token|secret|bus.?pass|roll.?no|faculty.?id)/i;
const { computeRecordHash } = require('./hashChain');

const ADMIN_AUDIT_HASH_CHAIN_LOCK_ID = 753422;

function sanitizeAuditSummary(value, depth = 0) {
  if (value === null || value === undefined) return value;
  if (depth > 4) return '[truncated]';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value.slice(0, 500);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.slice(0, 100).map((item) => sanitizeAuditSummary(item, depth + 1));
  if (typeof value !== 'object') return String(value).slice(0, 500);

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !SENSITIVE_KEY.test(key))
      .slice(0, 100)
      .map(([key, item]) => [key, sanitizeAuditSummary(item, depth + 1)])
  );
}

function changedFields(before, after, allowedFields) {
  return allowedFields.filter((field) => JSON.stringify(before?.[field] ?? null) !== JSON.stringify(after?.[field] ?? null));
}

function buildAdminAuditData(req, event) {
  return {
    adminIdentifier: String(req.user?.id || 'unknown-admin'),
    action: event.action,
    entityType: event.entityType,
    entityId: event.entityId === null || event.entityId === undefined ? null : String(event.entityId),
    beforeSummary: event.beforeSummary === undefined ? undefined : sanitizeAuditSummary(event.beforeSummary),
    afterSummary: event.afterSummary === undefined ? undefined : sanitizeAuditSummary(event.afterSummary),
    correlationId: req.requestId ? String(req.requestId).slice(0, 100) : null,
  };
}

function adminAuditHashData(row) {
  return {
    adminIdentifier: row.adminIdentifier,
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId,
    beforeSummary: row.beforeSummary,
    afterSummary: row.afterSummary,
    correlationId: row.correlationId,
    createdAt: row.createdAt,
    previousHash: row.previousHash,
  };
}

async function writeAdminAudit(client, req, event) {
  await client.$queryRawUnsafe(
    'SELECT 1::int AS locked FROM (SELECT pg_advisory_xact_lock($1)) AS acquired',
    ADMIN_AUDIT_HASH_CHAIN_LOCK_ID
  );
  const previous = await client.adminAuditLog.findFirst({
    where: { recordHash: { not: null } },
    orderBy: { id: 'desc' },
    select: { recordHash: true },
  });
  const data = {
    ...buildAdminAuditData(req, event),
    createdAt: new Date(),
    previousHash: previous?.recordHash || null,
  };
  data.recordHash = computeRecordHash(adminAuditHashData(data));
  return client.adminAuditLog.create({ data });
}

module.exports = {
  SENSITIVE_KEY,
  ADMIN_AUDIT_HASH_CHAIN_LOCK_ID,
  adminAuditHashData,
  buildAdminAuditData,
  changedFields,
  sanitizeAuditSummary,
  writeAdminAudit,
};
