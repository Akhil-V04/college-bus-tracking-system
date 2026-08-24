require('dotenv').config();

const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

const authRoutes = require('./routes/auth');
const routesRoutes = require('./routes/routes');
const stopsRoutes = require('./routes/stops');
const routeStopsRoutes = require('./routes/route-stops');
const driversRoutes = require('./routes/drivers');
const busesRoutes = require('./routes/buses');
const classAdvisorsRoutes = require('./routes/class-advisors');
const studentsRoutes = require('./routes/students');
const tripsRoutes = require('./routes/trips');
const lateAlertsRoutes = require('./routes/late-alerts');
const setupSocket = require('./socket');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/auth', authRoutes);
app.use('/routes', routesRoutes);
app.use('/stops', stopsRoutes);
app.use('/route-stops', routeStopsRoutes);
app.use('/drivers', driversRoutes);
app.use('/buses', busesRoutes);
app.use('/class-advisors', classAdvisorsRoutes);
app.use('/students', studentsRoutes);
app.use('/trips', tripsRoutes);
app.use('/late-alerts', lateAlertsRoutes);

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
});

// Expose the io instance to routes (used by /trips/:id/board to broadcast).
app.set('io', io);

setupSocket(io);

server.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
