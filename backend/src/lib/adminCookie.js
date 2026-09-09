const ADMIN_COOKIE_NAME = 'college_bus_admin';
const CSRF_HEADER = 'x-requested-with';
const CSRF_VALUE = 'college-bus-admin';

function cookieValue(header, name) {
  const prefix = `${name}=`;
  for (const part of String(header || '').split(';')) {
    const normalized = part.trim();
    if (normalized.startsWith(prefix)) return decodeURIComponent(normalized.slice(prefix.length));
  }
  return null;
}

function serializeAdminCookie(token, maxAgeSeconds, production = process.env.NODE_ENV === 'production') {
  const attributes = [
    `${ADMIN_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}`,
  ];
  if (production) attributes.push('Secure');
  return attributes.join('; ');
}

function clearAdminCookie(production = process.env.NODE_ENV === 'production') {
  return serializeAdminCookie('', 0, production);
}

function hasCsrfHeader(req) {
  return String(req.headers[CSRF_HEADER] || '') === CSRF_VALUE;
}

module.exports = {
  ADMIN_COOKIE_NAME,
  CSRF_HEADER,
  CSRF_VALUE,
  clearAdminCookie,
  cookieValue,
  hasCsrfHeader,
  serializeAdminCookie,
};
