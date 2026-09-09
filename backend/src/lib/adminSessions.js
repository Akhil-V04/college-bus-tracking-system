const DEFAULT_ADMIN_SESSION_MINUTES = 12 * 60;
const PRODUCTION_ADMIN_SESSION_MINUTES = 2 * 60;
const DEFAULT_DRIVER_TOKEN_MINUTES = 7 * 24 * 60;
const PRODUCTION_DRIVER_TOKEN_MINUTES = 12 * 60;
const SESSION_RETENTION_DAYS = 90;

function isSecureJwtSecret(value) {
  const secret = typeof value === 'string' ? value.trim() : '';
  if (secret.length < 32) return false;
  return !new Set([
    'dev-secret-change-me',
    'replace-with-a-long-random-secret',
    'change-me',
  ]).has(secret.toLowerCase());
}

function boundedPositiveInteger(value, fallback, maximum) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, maximum);
}

function resolveAuthPolicy(env = process.env, nodeEnv = process.env.NODE_ENV) {
  const production = nodeEnv === 'production';
  return {
    adminSessionMinutes: boundedPositiveInteger(
      env.ADMIN_SESSION_TTL_MINUTES,
      production ? PRODUCTION_ADMIN_SESSION_MINUTES : DEFAULT_ADMIN_SESSION_MINUTES,
      production ? 8 * 60 : 7 * 24 * 60
    ),
    driverTokenMinutes: boundedPositiveInteger(
      env.DRIVER_TOKEN_TTL_MINUTES,
      production ? PRODUCTION_DRIVER_TOKEN_MINUTES : DEFAULT_DRIVER_TOKEN_MINUTES,
      production ? 24 * 60 : 14 * 24 * 60
    ),
  };
}

function adminSessionExpiry(now, minutes) {
  return new Date(now.getTime() + minutes * 60 * 1000);
}

async function findActiveAdminSession(client, decoded, now = new Date()) {
  if (!decoded?.sessionId || typeof decoded.sessionId !== 'string') return null;
  return client.adminSession.findFirst({
    where: {
      id: decoded.sessionId,
      adminIdentifier: String(decoded.id),
      revokedAt: null,
      expiresAt: { gt: now },
    },
  });
}

async function revokeAdminSession(client, sessionId, reason, now = new Date()) {
  return client.adminSession.updateMany({
    where: { id: sessionId, revokedAt: null },
    data: { revokedAt: now, revokeReason: String(reason).slice(0, 100) },
  });
}

async function revokeAllAdminSessions(client, adminIdentifier, reason, now = new Date()) {
  return client.adminSession.updateMany({
    where: { adminIdentifier: String(adminIdentifier), revokedAt: null, expiresAt: { gt: now } },
    data: { revokedAt: now, revokeReason: String(reason).slice(0, 100) },
  });
}

async function pruneAdminSessions(client, now = new Date()) {
  const cutoff = new Date(now.getTime() - SESSION_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  return client.adminSession.deleteMany({
    where: {
      OR: [
        { expiresAt: { lt: cutoff } },
        { revokedAt: { lt: cutoff } },
      ],
    },
  });
}

module.exports = {
  DEFAULT_ADMIN_SESSION_MINUTES,
  DEFAULT_DRIVER_TOKEN_MINUTES,
  PRODUCTION_ADMIN_SESSION_MINUTES,
  PRODUCTION_DRIVER_TOKEN_MINUTES,
  SESSION_RETENTION_DAYS,
  adminSessionExpiry,
  boundedPositiveInteger,
  findActiveAdminSession,
  isSecureJwtSecret,
  pruneAdminSessions,
  resolveAuthPolicy,
  revokeAdminSession,
  revokeAllAdminSessions,
};
