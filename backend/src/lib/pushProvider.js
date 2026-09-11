class PushProviderError extends Error {
  constructor(code, options = {}) {
    super(code);
    this.name = 'PushProviderError';
    this.code = String(code || 'PUSH_PROVIDER_ERROR').replace(/[^A-Z0-9_-]/gi, '_').slice(0, 100);
    this.permanent = options.permanent === true;
    this.invalidToken = options.invalidToken === true;
  }
}

function createPushProvider(env = process.env, fetchImpl = fetch) {
  const name = String(env.PUSH_NOTIFICATION_PROVIDER || 'console').toLowerCase();
  if (name === 'disabled') return null;
  if (name === 'console') {
    return { name, send: async (item) => ({ receiptId: `simulated:${item.id}` }) };
  }
  if (name !== 'expo') throw new PushProviderError('UNKNOWN_PROVIDER', { permanent: true });
  const endpoint = String(env.EXPO_PUSH_URL || 'https://exp.host/--/api/v2/push/send');
  const receiptEndpoint = String(env.EXPO_PUSH_RECEIPTS_URL || 'https://exp.host/--/api/v2/push/getReceipts');
  if (!/^https:\/\//i.test(endpoint)) throw new PushProviderError('INVALID_EXPO_URL', { permanent: true });
  return {
    name,
    async send(item) {
      const response = await fetchImpl(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(env.EXPO_ACCESS_TOKEN ? { Authorization: `Bearer ${env.EXPO_ACCESS_TOKEN}` } : {}),
        },
        body: JSON.stringify({
          to: item.device.pushToken,
          title: item.payload?.title || 'College bus update',
          body: item.payload?.body || `${item.payload?.routeNo || 'Your bus'} update`,
          data: item.payload,
        }),
      });
      if (!response.ok) {
        throw new PushProviderError(response.status >= 500 ? 'EXPO_UNAVAILABLE' : `EXPO_HTTP_${response.status}`, {
          permanent: response.status >= 400 && response.status < 500,
        });
      }
      let body;
      try { body = await response.json(); }
      catch (_error) { throw new PushProviderError('EXPO_INVALID_RESPONSE'); }
      const ticket = Array.isArray(body?.data) ? body.data[0] : body?.data;
      if (ticket?.status === 'ok' && ticket.id) return { receiptId: String(ticket.id).slice(0, 500) };
      const providerCode = String(ticket?.details?.error || 'EXPO_REJECTED').toUpperCase();
      throw new PushProviderError(providerCode, {
        permanent: providerCode === 'DEVICENOTREGISTERED' || providerCode === 'MESSAGETOOBIG' || providerCode === 'INVALIDCREDENTIALS',
        invalidToken: providerCode === 'DEVICENOTREGISTERED',
      });
    },
    async checkReceipts(ids) {
      const response = await fetchImpl(receiptEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json', Accept: 'application/json',
          ...(env.EXPO_ACCESS_TOKEN ? { Authorization: `Bearer ${env.EXPO_ACCESS_TOKEN}` } : {}),
        },
        body: JSON.stringify({ ids }),
      });
      if (!response.ok) throw new PushProviderError('EXPO_RECEIPTS_UNAVAILABLE');
      const body = await response.json();
      return body?.data || {};
    },
  };
}

module.exports = { PushProviderError, createPushProvider };
