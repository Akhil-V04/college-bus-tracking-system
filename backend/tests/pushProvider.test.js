const test = require('node:test');
const assert = require('node:assert/strict');
const { createPushProvider } = require('../src/lib/pushProvider');

test('Expo push provider returns a receipt without exposing its credential', async () => {
  let request;
  const provider = createPushProvider({
    PUSH_NOTIFICATION_PROVIDER: 'expo', EXPO_ACCESS_TOKEN: 'synthetic-secret',
  }, async (url, options) => {
    request = { url, options };
    return { ok: true, json: async () => ({ data: { status: 'ok', id: 'receipt-1' } }) };
  });
  const result = await provider.send({
    id: 1, device: { pushToken: 'ExponentPushToken[synthetic]' }, payload: { routeNo: 'R1' },
  });
  assert.deepEqual(result, { receiptId: 'receipt-1' });
  assert.equal(JSON.stringify(result).includes('synthetic-secret'), false);
  assert.match(request.options.headers.Authorization, /^Bearer /);
});

test('Expo invalid-device response is permanent and deactivatable', async () => {
  const provider = createPushProvider({ PUSH_NOTIFICATION_PROVIDER: 'expo' }, async () => ({
    ok: true,
    json: async () => ({ data: { status: 'error', details: { error: 'DeviceNotRegistered' } } }),
  }));
  await assert.rejects(
    () => provider.send({ device: { pushToken: 'ExponentPushToken[synthetic]' }, payload: {} }),
    (error) => error.permanent === true && error.invalidToken === true
  );
});

test('Expo receipt checks use ticket IDs and return per-ticket outcomes', async () => {
  let requestBody;
  const provider = createPushProvider({ PUSH_NOTIFICATION_PROVIDER: 'expo' }, async (url, options) => {
    requestBody = JSON.parse(options.body);
    return { ok: true, json: async () => ({ data: { 'receipt-1': { status: 'ok' } } }) };
  });
  const receipts = await provider.checkReceipts(['receipt-1']);
  assert.deepEqual(requestBody, { ids: ['receipt-1'] });
  assert.equal(receipts['receipt-1'].status, 'ok');
});
