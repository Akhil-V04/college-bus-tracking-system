require('dotenv').config();

const assert = require('node:assert/strict');
const { io } = require('socket.io-client');

const baseUrl = String(process.env.HOSTED_BACKEND_URL || '').replace(/\/$/, '');
if (!/^https:\/\//i.test(baseUrl)) {
  console.error('[hosted-render] HOSTED_BACKEND_URL must be an HTTPS Render service URL');
  process.exit(1);
}

async function jsonRequest(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, { signal: AbortSignal.timeout(20_000), ...options });
  const body = await response.json();
  return { response, body };
}

async function socketConnect() {
  return new Promise((resolve, reject) => {
    const socket = io(baseUrl, {
      transports: ['websocket'],
      reconnection: false,
      timeout: 20_000,
    });
    const timer = setTimeout(() => {
      socket.close();
      reject(new Error('Hosted WSS connection timed out'));
    }, 25_000);
    socket.once('connect', () => {
      clearTimeout(timer);
      socket.close();
      resolve();
    });
    socket.once('connect_error', (error) => {
      clearTimeout(timer);
      socket.close();
      reject(error);
    });
  });
}

async function main() {
  const health = await jsonRequest('/health');
  assert.equal(health.response.status, 200);
  assert.equal(health.body.status, 'ok');
  assert.equal(health.response.headers.get('x-api-version'), '1');
  assert.ok(health.response.headers.get('x-content-type-options'));

  const readiness = await jsonRequest('/health/ready');
  assert.equal(readiness.response.status, 200);
  assert.deepEqual(readiness.body, { status: 'ready', database: 'ok' });
  assert.equal(JSON.stringify(readiness.body).toLowerCase().includes('password'), false);
  assert.equal(JSON.stringify(readiness.body).toLowerCase().includes('google_maps'), false);

  const routes = await jsonRequest('/api/v1/passenger/routes');
  assert.equal(routes.response.status, 200);
  const hostile = await jsonRequest('/health', { headers: { Origin: 'https://hostile.example.invalid' } });
  assert.equal(hostile.response.status, 403);

  await socketConnect();
  await socketConnect();

  console.log(JSON.stringify({
    hostedHttps: true,
    processHealth: 'ok',
    restrictedDatabaseReadiness: 'ok',
    publicRoutes: 'ok',
    hostileCorsRejected: true,
    websocketConnections: 2,
    reconnectVerified: true,
    secretsAbsentFromHealth: true,
  }));
}

main().catch((error) => {
  console.error(`[hosted-render] ${error.message}`);
  process.exitCode = 1;
});
