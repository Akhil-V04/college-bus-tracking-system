const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const TOKEN_EXPIRY = '7d';

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

// Verifies the Bearer token and enforces an allowed role list.
// Attaches the decoded payload to req.user.
function requireAuth(allowedRoles) {
  return (req, res, next) => {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;

    if (!token) {
      return res.status(401).json({ error: 'Missing or invalid Authorization header' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    if (!allowedRoles.includes(decoded.role)) {
      return res.status(403).json({ error: 'You do not have permission to access this resource' });
    }

    req.user = decoded;
    next();
  };
}

module.exports = { signToken, requireAuth, JWT_SECRET };
