const { randomUUID } = require('crypto');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const prisma = require('../lib/prisma');
const { resolveDeploymentPolicy } = require('../lib/deployment');
const { PostgresRateLimitStore } = require('../lib/postgresRateLimitStore');

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_LIMIT = 10;
const IMPORT_WINDOW_MS = 10 * 60 * 1000;
const IMPORT_LIMIT = 20;
const GPS_WINDOW_MS = 60 * 1000;
const GPS_LIMIT = 120;

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function securityHeaders() {
  return helmet({
    // This process serves JSON/WebSocket APIs rather than executable pages.
    contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
    crossOriginResourcePolicy: { policy: 'same-site' },
  });
}

function createLimiterStore(prefix, env = process.env, client = prisma) {
  const policy = resolveDeploymentPolicy(env);
  if (policy.rateLimitStore !== 'postgres') return undefined;
  return new PostgresRateLimitStore({ prisma: client, prefix });
}

function createRateLimiters(env = process.env, client = prisma) {
  const loginStore = createLimiterStore('login', env, client);
  const importStore = createLimiterStore('roster-import', env, client);
  const login = rateLimit({
    windowMs: positiveInteger(env.LOGIN_RATE_LIMIT_WINDOW_MS, LOGIN_WINDOW_MS),
    limit: positiveInteger(env.LOGIN_RATE_LIMIT_MAX, LOGIN_LIMIT),
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    message: { error: 'Too many failed login attempts. Try again later.' },
    passOnStoreError: false,
    ...(loginStore ? { store: loginStore } : {}),
  });
  const rosterImport = rateLimit({
    windowMs: positiveInteger(env.IMPORT_RATE_LIMIT_WINDOW_MS, IMPORT_WINDOW_MS),
    limit: positiveInteger(env.IMPORT_RATE_LIMIT_MAX, IMPORT_LIMIT),
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Too many roster import requests. Try again later.' },
    passOnStoreError: false,
    ...(importStore ? { store: importStore } : {}),
  });
  return { login, rosterImport };
}

function requestMetadata(req, res, durationMs) {
  return {
    type: 'http_request',
    requestId: req.requestId,
    method: req.method,
    // originalUrl can contain query values. Logging only the matched path
    // avoids recording tokens, filters, identifiers, or other private input.
    path: req.route?.path ? `${req.baseUrl || ''}${req.route.path}` : req.path,
    status: res.statusCode,
    durationMs: Math.round(durationMs * 100) / 100,
    role: req.user?.role || 'anonymous',
  };
}

function requestLogger(options = {}) {
  const logger = options.logger || console;
  const enabled = options.enabled ?? process.env.REQUEST_LOGGING_ENABLED !== 'false';
  return (req, res, next) => {
    req.requestId = req.get('x-request-id')?.trim().slice(0, 100) || randomUUID();
    res.setHeader('X-Request-Id', req.requestId);
    if (!enabled) return next();
    const started = process.hrtime.bigint();
    res.once('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - started) / 1_000_000;
      logger.info(JSON.stringify(requestMetadata(req, res, durationMs)));
    });
    return next();
  };
}

function consumeSocketRate(socket, key, options = {}) {
  const now = options.now || Date.now();
  const windowMs = positiveInteger(options.windowMs || process.env.GPS_RATE_LIMIT_WINDOW_MS, GPS_WINDOW_MS);
  const limit = positiveInteger(options.limit || process.env.GPS_RATE_LIMIT_MAX, GPS_LIMIT);
  socket.data.rateLimits ||= {};
  const current = socket.data.rateLimits[key];
  if (!current || now - current.startedAt >= windowMs) {
    socket.data.rateLimits[key] = { startedAt: now, count: 1 };
    return { allowed: true, remaining: limit - 1, retryAfterMs: 0 };
  }
  current.count += 1;
  if (current.count <= limit) return { allowed: true, remaining: limit - current.count, retryAfterMs: 0 };
  return {
    allowed: false,
    remaining: 0,
    retryAfterMs: Math.max(1, current.startedAt + windowMs - now),
  };
}

module.exports = {
  GPS_LIMIT,
  GPS_WINDOW_MS,
  IMPORT_LIMIT,
  IMPORT_WINDOW_MS,
  LOGIN_LIMIT,
  LOGIN_WINDOW_MS,
  consumeSocketRate,
  createLimiterStore,
  createRateLimiters,
  positiveInteger,
  requestLogger,
  requestMetadata,
  securityHeaders,
};
