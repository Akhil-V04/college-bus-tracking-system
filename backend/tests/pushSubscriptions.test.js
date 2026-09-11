const test = require('node:test');
const assert = require('node:assert/strict');

const { normalizePushToken, tokenHash } = require('../src/routes/push-subscriptions');

test('push tokens are validated and represented by stable non-reversible hashes', () => {
  const token = 'ExponentPushToken[synthetic-only-token-123456]';
  assert.equal(normalizePushToken(token), token);
  assert.match(tokenHash(token), /^[a-f0-9]{64}$/);
  assert.equal(tokenHash(token).includes('synthetic-only-token'), false);
  assert.equal(normalizePushToken('short token'), null);
});
