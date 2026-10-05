const test = require('node:test');
const assert = require('node:assert/strict');

const { feedbackFingerprint } = require('../src/routes/feedback');

test('feedback duplicate fingerprints are stable and contain no submitted text or identity', () => {
  const input = { category: 'APP_ISSUE', description: 'The map did not refresh', routeServiceId: 2 };
  const first = feedbackFingerprint(input, 'synthetic-client', 'synthetic-secret');
  const second = feedbackFingerprint({ ...input, description: '  THE MAP did not   refresh ' }, 'synthetic-client', 'synthetic-secret');
  assert.equal(first, second);
  assert.match(first, /^[a-f0-9]{64}$/);
  assert.equal(first.includes('map'), false);
  assert.equal(first.includes('client'), false);
});
