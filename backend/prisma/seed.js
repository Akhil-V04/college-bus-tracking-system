require('dotenv').config();

const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function findOrCreateStop(data) {
  const existing = await prisma.stop.findFirst({ where: { name: data.name } });
  return existing || prisma.stop.create({ data });
}

async function main() {
  const passwordHash = await bcrypt.hash('ChangeMe123!', 10);
  const driver = await prisma.driver.upsert({
    where: { driverCode: 'DRV001' },
    update: {},
    create: {
      driverCode: 'DRV001',
      name: 'Demo Driver',
      phone: '9000000000',
      licenseNo: 'DEMO-LICENCE-001',
      passwordHash,
    },
  });

  const route = await prisma.routeService.upsert({
    where: { routeNo: '01' },
    update: { capacity: 52, driverId: driver.id },
    create: {
      routeNo: '01',
      name: 'Demo Hyderabad Route',
      areaCovered: 'Demo data for local development only',
      capacity: 52,
      driverId: driver.id,
    },
  });

  const firstStop = await findOrCreateStop({ name: 'Demo Start', latitude: 17.405, longitude: 78.56 });
  const collegeStop = await findOrCreateStop({ name: 'College', latitude: 17.451, longitude: 78.645 });

  const schedule = await prisma.scheduleVersion.upsert({
    where: {
      routeServiceId_direction_version: {
        routeServiceId: route.id,
        direction: 'MORNING',
        version: 1,
      },
    },
    update: { status: 'PUBLISHED', publishedAt: new Date() },
    create: {
      routeServiceId: route.id,
      name: 'Demo Morning Schedule',
      direction: 'MORNING',
      version: 1,
      status: 'PUBLISHED',
      publishedAt: new Date(),
    },
  });
  await prisma.scheduleStop.createMany({
    data: [
      { scheduleVersionId: schedule.id, stopId: firstStop.id, sequenceOrder: 0, scheduledTime: '08:45' },
      { scheduleVersionId: schedule.id, stopId: collegeStop.id, sequenceOrder: 1, scheduledTime: '09:45' },
    ],
    skipDuplicates: true,
  });

  const roster = await prisma.transportRoster.upsert({
    where: { academicYear_version: { academicYear: '2026-27', version: 1 } },
    update: { status: 'PUBLISHED', publishedAt: new Date() },
    create: {
      name: 'Demo Transport Roster 2026-27',
      academicYear: '2026-27',
      version: 1,
      status: 'PUBLISHED',
      publishedAt: new Date(),
    },
  });
  await prisma.rosterPassenger.upsert({
    where: { rosterId_busPassId: { rosterId: roster.id, busPassId: '000124' } },
    update: {},
    create: {
      rosterId: roster.id,
      routeServiceId: route.id,
      boardingStopId: firstStop.id,
      passengerType: 'STUDENT',
      name: 'Demo Student',
      busPassId: '000124',
      rollNo: '22CSE104',
      department: 'CSE',
      year: 3,
      section: 'A',
    },
  });
  await prisma.rosterPassenger.upsert({
    where: { rosterId_busPassId: { rosterId: roster.id, busPassId: 'FAC-PASS-001' } },
    update: {},
    create: {
      rosterId: roster.id,
      routeServiceId: route.id,
      boardingStopId: firstStop.id,
      passengerType: 'FACULTY',
      name: 'Demo Faculty',
      busPassId: 'FAC-PASS-001',
      facultyId: 'FAC001',
    },
  });

  await prisma.classAdvisor.upsert({
    where: { email: 'advisor@example.edu' },
    update: {},
    create: {
      name: 'Demo Class Advisor',
      phone: '9000000001',
      email: 'advisor@example.edu',
      department: 'CSE',
      year: 3,
      section: 'A',
    },
  });

  console.log('Development seed completed. Change the demo driver password before any shared environment.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
