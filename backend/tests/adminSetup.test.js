const test = require('node:test');
const assert = require('node:assert/strict');
const { validatePassword, updateEnvContent } = require('../scripts/set-admin-password');

test('admin password policy rejects weak passwords and accepts a strong one', () => {
  assert.ok(validatePassword('short').length >= 4);
  assert.deepEqual(validatePassword('StrongLocal#2026'), []);
});

test('admin setup updates existing env keys without exposing a plain password', () => {
  const updated = updateEnvContent(
    'PORT=4000\nADMIN_EMAIL="old@example.edu"\nADMIN_PASSWORD_HASH=""\n',
    {
      ADMIN_EMAIL: 'transport@example.edu',
      ADMIN_PASSWORD_HASH: '$2b$12$examplehash',
    }
  );
  assert.match(updated, /ADMIN_EMAIL="transport@example\.edu"/);
  assert.match(updated, /ADMIN_PASSWORD_HASH="\$2b\$12\$examplehash"/);
  assert.equal((updated.match(/ADMIN_EMAIL=/g) || []).length, 1);
});

test('admin setup appends missing env keys', () => {
  const updated = updateEnvContent('PORT=4000\n', {
    ADMIN_EMAIL: 'admin@example.edu',
    ADMIN_PASSWORD_HASH: 'hash',
  });
  assert.match(updated, /ADMIN_EMAIL="admin@example\.edu"/);
  assert.match(updated, /ADMIN_PASSWORD_HASH="hash"/);
});
