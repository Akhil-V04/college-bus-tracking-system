require('dotenv').config();

const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

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
const setupSocket = require('./socket');

const app = express();
const server = http.createServer(app);
const PORT = Number(process.env.PORT || 4000);

const configuredOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);
const corsOptions = {
  origin(origin, callback) {
    if (!origin || configuredOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Origin is not allowed by CORS'));
  },
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '2mb' }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', version: '2.0.0-foundation' });
});

app.use('/auth', authRoutes);
app.use('/route-services', routeServiceRoutes);
app.use('/stops', stopRoutes);
app.use('/schedules', scheduleRoutes);
app.use('/rosters', rosterRoutes);
app.use('/drivers', driverRoutes);
app.use('/class-advisors', classAdvisorRoutes);
app.use('/trips', tripRoutes);
app.use('/passenger', passengerRoutes);
app.use('/late-alerts', lateAlertRoutes);

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
  server.listen(PORT, () => {
    console.log(`Backend running on http://localhost:${PORT}`);
  });
}

module.exports = { app, server, io };
