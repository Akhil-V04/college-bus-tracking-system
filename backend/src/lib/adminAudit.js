const SENSITIVE_KEY = /(password|hash|phone|license|email|recipient|token|secret|bus.?pass|roll.?no|faculty.?id)/i;

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
  };
}

async function writeAdminAudit(client, req, event) {
  return client.adminAuditLog.create({ data: buildAdminAuditData(req, event) });
}

module.exports = {
  SENSITIVE_KEY,
  buildAdminAuditData,
  changedFields,
  sanitizeAuditSummary,
  writeAdminAudit,
};
