require('dotenv').config();
process.env.REQUEST_LOGGING_ENABLED = 'false';

const assert = require('node:assert/strict');
const { io: connectClient } = require('socket.io-client');
const prisma = require('../src/lib/prisma');
const { server } = require('../src/index');
const { signToken } = require('../src/middleware/auth');

const suffix = `${Date.now()}-${Math.random().toString(16).slice(2, 7)}`;
const fixtures = [];
const clients = [];

function listen() {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
  });
}

function connect(url, token) {
  return new Promise((resolve, reject) => {
    const client = connectClient(url, {
      transports: ['websocket'],
      forceNew: true,
      auth: token ? { token } : {},
    });
    clients.push(client);
    client.once('connect', () => resolve(client));
    client.once('connect_error', reject);
  });
}

function emitAck(client, event, payload) {
  return new Promise((resolve) => client.timeout(3000).emit(event, payload, (error, response) => {
    if (error) resolve({ ok: false, error: error.message });
    else resolve(response);
  }));
}

async function createRouteFixture(label, coordinate) {
  const driver = await prisma.driver.create({
    data: {
      driverCode: `SOCKET-${label}-${suffix}`,
      name: `Socket ${label} Driver`,
      phone: `${label === 'A' ? '7' : '8'}${String(Date.now()).slice(-9)}`,
      licenseNo: `SOCKET-${label}-${suffix}`,
      passwordHash: 'integration-test-only',
    },
  });
  const route = await prisma.routeService.create({
    data: {
      routeNo: `SOCKET-${label}-${suffix}`,
      name: `Socket ${label} Route`,
      areaCovered: 'Temporary socket isolation fixture',
      capacity: 10,
      driverId: driver.id,
    },
  });
  const stop = await prisma.stop.create({
    data: { name: `Socket ${label} Stop`, latitude: coordinate.latitude, longitude: coordinate.longitude },
  });
  const schedule = await prisma.scheduleVersion.create({
    data: {
      routeServiceId: route.id,
      name: `Socket ${label} Schedule`,
      status: 'PUBLISHED',
      version: 1,
      stops: {
        create: { stopId: stop.id, sequenceOrder: 1, scheduledTime: '09:00' },
      },
    },
  });
  const roster = await prisma.transportRoster.create({
    data: {
      name: `Socket ${label} Roster`,
      academicYear: `SOCKET-${label}-${suffix}`,
      status: 'PUBLISHED',
      version: 1,
    },
  });
  const trip = await prisma.trip.create({
    data: {
      routeServiceId: route.id,
      driverId: driver.id,
      rosterId: roster.id,
      scheduleVersionId: schedule.id,
      date: new Date(),
      startTime: new Date(),
      status: 'RUNNING',
    },
  });
  const fixture = { driver, route, stop, schedule, roster, trip, coordinate };
  fixtures.push(fixture);
  return fixture;
}

async function cleanup() {
  clients.forEach((client) => client.disconnect());
  for (const fixture of [...fixtures].reverse()) {
    await prisma.trip.deleteMany({ where: { id: fixture.trip.id } });
    await prisma.scheduleVersion.deleteMany({ where: { id: fixture.schedule.id } });
    await prisma.transportRoster.deleteMany({ where: { id: fixture.roster.id } });
    await prisma.routeService.deleteMany({ where: { id: fixture.route.id } });
    await prisma.stop.deleteMany({ where: { id: fixture.stop.id } });
    await prisma.driver.deleteMany({ where: { id: fixture.driver.id } });
  }
  if (server.listening) await new Promise((resolve) => server.close(resolve));
  await prisma.$disconnect();
}

async function run() {
  const routeA = await createRouteFixture('A', { latitude: 17.391, longitude: 78.319 });
  const routeB = await createRouteFixture('B', { latitude: 17.491, longitude: 78.419 });
  const port = await listen();
  const url = `http://127.0.0.1:${port}`;

  const passengerA = await connect(url);
  const passengerB = await connect(url);
  const anonymous = await connect(url);
  const driverA = await connect(url, signToken({ role: 'driver', id: routeA.driver.id, sessionVersion: routeA.driver.sessionVersion }));
  const driverB = await connect(url, signToken({ role: 'driver', id: routeB.driver.id, sessionVersion: routeB.driver.sessionVersion }));

  assert.equal((await emitAck(passengerA, 'join:trip', { tripId: routeA.trip.id })).ok, true);
  assert.equal((await emitAck(passengerB, 'join:trip', { tripId: routeB.trip.id })).ok, true);
  let routeAUpdates = 0;
  let routeBUpdates = 0;
  passengerA.on('bus:update', () => { routeAUpdates += 1; });
  passengerB.on('bus:update', () => { routeBUpdates += 1; });

  const anonymousResult = await emitAck(anonymous, 'driver:location', {
    tripId: routeA.trip.id,
    ...routeA.coordinate,
  });
  assert.equal(anonymousResult.ok, false);
  assert.match(anonymousResult.error, /authentication/i);

  const wrongDriver = await emitAck(driverB, 'driver:location', {
    tripId: routeA.trip.id,
    ...routeA.coordinate,
    accuracyMeters: 10,
    deviceTimestamp: new Date().toISOString(),
  });
  assert.equal(wrongDriver.ok, false);
  assert.match(wrongDriver.error, /another driver|revoked/i);

  const accepted = await emitAck(driverA, 'driver:location', {
    tripId: routeA.trip.id,
    ...routeA.coordinate,
    accuracyMeters: 10,
    deviceTimestamp: new Date().toISOString(),
  });
  assert.equal(accepted.ok, true);
  await new Promise((resolve) => setTimeout(resolve, 250));
  assert.equal(routeAUpdates, 1);
  assert.equal(routeBUpdates, 0);

  console.log(JSON.stringify({
    anonymousGpsRejected: true,
    wrongDriverRejected: true,
    routeAUpdates,
    routeBUpdates,
    crossRouteLeakage: false,
  }));
}

run().finally(cleanup);
