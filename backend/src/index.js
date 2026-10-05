require('dotenv').config();

const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const { requestLogger, securityHeaders } = require('./middleware/security');
const prisma = require('./lib/prisma');
const { resolveDeploymentPolicy } = require('./lib/deployment');

const authRoutes = require('./routes/auth');
const routeServiceRoutes = require('./routes/route-services');
const stopRoutes = require('./routes/stops');
const scheduleRoutes = require('./routes/schedules');
const rosterRoutes = require('./routes/rosters');
const driverRoutes = require('./routes/drivers');
const classAdvisorRoutes = require('./routes/class-advisors');
const tripRoutes = require('./routes/trips');
const passengerRoutes = require('./routes/passenger');
const lateAlertRoutes = require('./routes/late-alerts');
const adminAuditLogRoutes = require('./routes/admin-audit-logs');
const operationsRoutes = require('./routes/operations');
const pushSubscriptionRoutes = require('./routes/push-subscriptions');
const feedbackRoutes = require('./routes/feedback');
const emergencyRoutes = require('./routes/emergencies');
const issuesRoutes = require('./routes/issues');
const assistantRoutes = require('./routes/assistant');
const knowledgeRoutes = require('./routes/knowledge');
const setupSocket = require('./socket');
const { setupStaleTripMonitor } = require('./lib/staleTripMonitor');
const { setupNotificationOutboxWorker } = require('./lib/notificationOutbox');
const { setupPushOutboxWorker } = require('./lib/pushOutbox');
const { assertRuntimeIdentity } = require('./lib/runtimeIdentity');

const app = express();
const server = http.createServer(app);
const PORT = Number(process.env.PORT || 4000);
const deploymentPolicy = resolveDeploymentPolicy(process.env);

if (deploymentPolicy.trustProxyHops > 0) app.set('trust proxy', deploymentPolicy.trustProxyHops);

const configuredOrigins = new Set((process.env.CORS_ORIGINS || 'http://localhost:5173')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean));

if (process.env.NODE_ENV !== 'production') {
  configuredOrigins.add('http://localhost:5173');
  configuredOrigins.add('http://127.0.0.1:5173');
}
const corsOptions = {
  credentials: true,
  origin(origin, callback) {
    if (!origin || configuredOrigins.has(origin)) return callback(null, true);
    return callback(new Error('Origin is not allowed by CORS'));
  },
};

app.use((_req, res, next) => {
  res.setHeader('X-API-Version', '1');
  next();
});
app.use(securityHeaders());
app.use(requestLogger());
app.use(cors(corsOptions));
app.use(express.json({ limit: '2mb' }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', version: '2.1.0' });
});

app.get('/health/ready', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    await assertRuntimeIdentity(prisma);
    return res.json({ status: 'ready', database: 'ok' });
  } catch (error) {
    console.error('[health/ready]', error);
    return res.status(503).json({ status: 'not-ready', database: 'unavailable' });
  }
});

function mountApi(router) {
  router.use('/auth', authRoutes);
  router.use('/route-services', routeServiceRoutes);
  router.use('/stops', stopRoutes);
  router.use('/schedules', scheduleRoutes);
  router.use('/rosters', rosterRoutes);
  router.use('/drivers', driverRoutes);
  router.use('/class-advisors', classAdvisorRoutes);
  router.use('/trips', tripRoutes);
  router.use('/passenger', passengerRoutes);
  router.use('/late-alerts', lateAlertRoutes);
  router.use('/admin-audit-logs', adminAuditLogRoutes);
  router.use('/operations', operationsRoutes);
  router.use('/push-subscriptions', pushSubscriptionRoutes);
  router.use('/feedback', feedbackRoutes);
  router.use('/emergencies', emergencyRoutes);
  router.use('/issues', issuesRoutes);
  router.use('/assistant', assistantRoutes);
  router.use('/knowledge', knowledgeRoutes);
  router.use('/admin-notifications', require('./routes/admin-notifications'));
}

// Existing clients remain compatible while new clients use the stable v1 prefix.
mountApi(app);
const apiV1 = express.Router();
mountApi(apiV1);
app.use('/api/v1', apiV1);

app.use((_req, res) => res.status(404).json({ error: 'Not found' }));
app.use((error, _req, res, _next) => {
  if (error.message === 'Origin is not allowed by CORS') {
    return res.status(403).json({ error: error.message });
  }
  console.error('[unhandled]', error);
  return res.status(500).json({ error: 'Internal server error' });
});

const io = new Server(server, { cors: corsOptions });
app.set('io', io);
setupSocket(io);

if (require.main === module) {
  let staleTripMonitor;
  let notificationWorker;
  let pushWorker;
  let shuttingDown = false;

  async function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(JSON.stringify({ type: 'shutdown', signal, state: 'started' }));
    staleTripMonitor?.stop();
    notificationWorker?.stop();
    pushWorker?.stop();
    const timeoutMs = Math.max(1000, Math.min(30_000, Number(process.env.GRACEFUL_SHUTDOWN_TIMEOUT_MS || 10_000)));
    const timeout = setTimeout(() => {
      server.closeAllConnections?.();
      process.exitCode = 1;
    }, timeoutMs);
    timeout.unref?.();
    await new Promise((resolve) => io.close(resolve));
    await prisma.$disconnect();
    clearTimeout(timeout);
    console.log(JSON.stringify({ type: 'shutdown', signal, state: 'complete' }));
  }

  process.once('SIGTERM', () => shutdown('SIGTERM').catch((error) => {
    console.error(`[shutdown] ${error.message}`);
    process.exitCode = 1;
  }));
  process.once('SIGINT', () => shutdown('SIGINT').catch((error) => {
    console.error(`[shutdown] ${error.message}`);
    process.exitCode = 1;
  }));

  assertRuntimeIdentity(prisma)
    .then(() => {
      staleTripMonitor = setupStaleTripMonitor(io);
      notificationWorker = setupNotificationOutboxWorker();
      pushWorker = setupPushOutboxWorker();
      server.listen(PORT, () => {
        console.log(JSON.stringify({ type: 'startup', state: 'ready', port: PORT }));
      });
    })
    .catch(async (error) => {
      console.error(`[startup] ${error.message}`);
      process.exitCode = 1;
      await prisma.$disconnect();
    });
}

module.exports = { app, server, io };
