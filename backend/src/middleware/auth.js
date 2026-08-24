const jwt = require('jsonwebtoken');

const isProduction = process.env.NODE_ENV === 'production';
const configuredSecret = process.env.JWT_SECRET;

if (isProduction && (!configuredSecret || configuredSecret === 'dev-secret-change-me')) {
  throw new Error('A secure JWT_SECRET is required in production');
}

const JWT_SECRET = configuredSecret || 'dev-secret-change-me';
const TOKEN_EXPIRY = '7d';

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

function requireAuth(allowedRoles) {
  return (req, res, next) => {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Missing or invalid Authorization header' });

    try {
      const decoded = verifyToken(token);
      if (!allowedRoles.includes(decoded.role)) {
        return res.status(403).json({ error: 'You do not have permission to access this resource' });
      }
      req.user = decoded;
      return next();
    } catch (_error) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  };
}

module.exports = { signToken, verifyToken, requireAuth, JWT_SECRET };
