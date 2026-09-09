const test = require('node:test');
const assert = require('node:assert/strict');
const { ADMIN_COOKIE_NAME, clearAdminCookie, cookieValue, hasCsrfHeader, serializeAdminCookie } = require('../src/lib/adminCookie');

test('administrator cookie is HttpOnly, strict, scoped and secure in production', () => {
  const header = serializeAdminCookie('signed.token', 120, true);
  assert.match(header, new RegExp(`^${ADMIN_COOKIE_NAME}=`));
  for (const attribute of ['HttpOnly', 'SameSite=Strict', 'Path=/', 'Max-Age=120', 'Secure']) assert.match(header, new RegExp(attribute));
  assert.equal(cookieValue(`other=x; ${header}`, ADMIN_COOKIE_NAME), 'signed.token');
  assert.match(clearAdminCookie(false), /Max-Age=0/);
});

test('cookie-authenticated mutations require the non-form CSRF header', () => {
  assert.equal(hasCsrfHeader({ headers: {} }), false);
  assert.equal(hasCsrfHeader({ headers: { 'x-requested-with': 'college-bus-admin' } }), true);
});
