require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const bcrypt = require('bcrypt');
const prisma = require('../src/lib/prisma');

async function setupDriverAccounts() {
  console.log('--- Setting Up Driver Accounts for All Route Numbers ---');
  const targetPassword = '1234';
  const passwordHash = await bcrypt.hash(targetPassword, 10);

  // 1. Fetch all routes
  const routes = await prisma.routeService.findMany({
    include: { driver: true },
    orderBy: { routeNo: 'asc' },
  });

  console.log(`Found ${routes.length} routes in database.`);
  const summary = [];

  for (const route of routes) {
    const isDemo = route.routeNo === 'DEMO';
    // ID format: DRV01, DRV02, ... DRV10, ... DRV29, DRV31, DEMO
    const targetDriverCode = isDemo ? 'DEMO' : `DRV${route.routeNo.padStart(2, '0')}`;

    if (route.driver) {
      // Update existing driver assigned to this route
      const updated = await prisma.driver.update({
        where: { id: route.driver.id },
        data: {
          driverCode: targetDriverCode,
          passwordHash,
          status: 'ACTIVE',
          sessionVersion: { increment: 1 },
        },
      });

      summary.push({
        routeNo: route.routeNo,
        routeName: route.name,
        driverCode: updated.driverCode,
        driverName: updated.name,
        phone: updated.phone,
        password: targetPassword,
        status: updated.status,
      });
    } else {
      // Check if driver with this driverCode already exists
      let driver = await prisma.driver.findUnique({
        where: { driverCode: targetDriverCode },
      });

      if (driver) {
        driver = await prisma.driver.update({
          where: { id: driver.id },
          data: {
            passwordHash,
            status: 'ACTIVE',
            sessionVersion: { increment: 1 },
          },
        });
      } else {
        driver = await prisma.driver.create({
          data: {
            driverCode: targetDriverCode,
            name: `Driver Route ${route.routeNo}`,
            phone: `990000${route.routeNo.padStart(4, '0')}`,
            licenseNo: `LIC-VBIT-${route.routeNo}`,
            passwordHash,
            status: 'ACTIVE',
          },
        });
      }

      // Assign driver to route
      await prisma.routeService.update({
        where: { id: route.id },
        data: { driverId: driver.id },
      });

      summary.push({
        routeNo: route.routeNo,
        routeName: route.name,
        driverCode: driver.driverCode,
        driverName: driver.name,
        phone: driver.phone,
        password: targetPassword,
        status: driver.status,
      });
    }
  }

  // Also ensure any unassigned drivers have password set to '1234'
  const unassignedDrivers = await prisma.driver.findMany({
    where: { assignedRoute: null },
  });
  for (const d of unassignedDrivers) {
    await prisma.driver.update({
      where: { id: d.id },
      data: {
        passwordHash,
        status: 'ACTIVE',
        sessionVersion: { increment: 1 },
      },
    });
  }

  console.log('\n=== DRIVER ACCOUNTS CONFIGURED SUCCESSFULLY ===');
  console.table(
    summary.map((s) => ({
      'Route #': s.routeNo,
      'Driver ID': s.driverCode,
      'Password': s.password,
      'Driver Name': s.driverName,
      'Phone': s.phone,
    }))
  );

  console.log('\nSummary count:', summary.length, 'driver accounts ready.');
}

setupDriverAccounts()
  .then(() => {
    console.log('Driver accounts setup completed.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Failed to setup driver accounts:', err);
    process.exit(1);
  });
