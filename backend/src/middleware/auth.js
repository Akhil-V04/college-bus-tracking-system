const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');
const { findActiveAdminSession, isSecureJwtSecret, resolveAuthPolicy } = require('../lib/adminSessions');
const { ADMIN_COOKIE_NAME, cookieValue, hasCsrfHeader } = require('../lib/adminCookie');

const isProduction = process.env.NODE_ENV === 'production';
const configuredSecret = process.env.JWT_SECRET;

if (isProduction && !isSecureJwtSecret(configuredSecret)) {
  throw new Error('A non-placeholder JWT_SECRET of at least 32 characters is required in production');
}

const JWT_SECRET = configuredSecret || 'dev-secret-change-me';
const JWT_ISSUER = 'college-bus-tracking';
const JWT_AUDIENCE = 'college-bus-clients';
const AUTH_POLICY = resolveAuthPolicy(process.env, process.env.NODE_ENV);

function signToken(payload, options = {}) {
  const expiresInMinutes = options.expiresInMinutes || (
    payload.role === 'admin' ? AUTH_POLICY.adminSessionMinutes : AUTH_POLICY.driverTokenMinutes
  );
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: Math.floor(expiresInMinutes * 60),
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  });
}

function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET, { issuer: JWT_ISSUER, audience: JWT_AUDIENCE });
}

function requireAuth(allowedRoles) {
  return async (req, res, next) => {
    const header = req.headers.authorization || '';
    const bearerToken = header.startsWith('Bearer ') ? header.slice(7) : null;
    const cookieToken = cookieValue(req.headers.cookie, ADMIN_COOKIE_NAME);
    const token = bearerToken || cookieToken;
    const cookieAuthenticated = !bearerToken && Boolean(cookieToken);
    if (!token) return res.status(401).json({ error: 'Authentication is required' });

    try {
      const decoded = verifyToken(token);
      if (!allowedRoles.includes(decoded.role)) {
        return res.status(403).json({ error: 'You do not have permission to access this resource' });
      }
      req.user = decoded;
      req.authSource = cookieAuthenticated ? 'cookie' : 'bearer';
      if (cookieAuthenticated && decoded.role !== 'admin') {
        return res.status(401).json({ error: 'Invalid cookie session' });
      }
      if (cookieAuthenticated && !['GET', 'HEAD', 'OPTIONS'].includes(req.method) && !hasCsrfHeader(req)) {
        return res.status(403).json({ error: 'CSRF protection header is required' });
      }
    } catch (_error) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    if (req.user.role === 'admin') {
      try {
        const session = await findActiveAdminSession(prisma, req.user);
        if (!session) return res.status(401).json({ error: 'Administrator session is invalid, expired, or revoked' });
        req.adminSession = session;
      } catch (error) {
        console.error('[auth/session-check]', error);
        return res.status(503).json({ error: 'Authentication service is temporarily unavailable' });
      }
    }
    return next();
  };
}

module.exports = {
  AUTH_POLICY,
  JWT_AUDIENCE,
  JWT_ISSUER,
  JWT_SECRET,
  requireAuth,
  signToken,
  verifyToken,
};