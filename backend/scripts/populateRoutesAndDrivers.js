require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const prisma = require('../src/lib/prisma');

const MD_PATH = path.resolve(__dirname, '../../docs/VBIT_College_Transport_RAG_Knowledge_Base.md');
const DEFAULT_PASSWORD = '1234';

function normalizeText(text) {
  return text.replace(/\u00A0/g, ' ').replace(/\r\n/g, '\n');
}

function parseTime(raw) {
  if (!raw) return '08:30';
  const clean = raw.trim();
  const m = clean.match(/(\d{1,2}):(\d{2})/);
  if (!m) return '08:30';
  const hh = m[1].padStart(2, '0');
  const mm = m[2];
  return `${hh}:${mm}`;
}

function parseMarkdownRoutes(content) {
  const normalized = normalizeText(content);
  const sections = normalized.split(/(?=\n###?\s+)/g).map((s) => s.trim()).filter(Boolean);
  const routes = [];

  for (const sec of sections) {
    const headingMatch = sec.match(/^###\s+(Route\s+(\d+)|Demo Route[^\n]*)/i);
    if (!headingMatch) continue;

    const isDemo = /demo/i.test(headingMatch[0]);
    const routeNum = isDemo ? 'DEMO' : headingMatch[2];

    if (routeNum === '30') {
      // Route 30 explicitly does not exist
      continue;
    }

    // Extract stops text
    const stopsMatch = sec.match(/\*\*Stops\/times[^*]*\*\*\s*([\s\S]+?)(?=\*\*Bus|\*\*Driver|\*\*Status|$)/i);
    let rawStopsStr = stopsMatch ? stopsMatch[1].trim().replace(/\s+/g, ' ') : '';
    // Strip trailing period if present
    rawStopsStr = rawStopsStr.replace(/\.\s*$/, '');

    // Extract driver
    const driverMatch = sec.match(/\*\*Driver:\*\*\s*([^-]+)---\s*(\d+)/i);
    const driverName = driverMatch ? driverMatch[1].trim().replace(/\s+/g, ' ') : `Driver Route ${routeNum}`;
    const driverPhone = driverMatch ? driverMatch[2].trim() : `99000000${routeNum.padStart(2, '0')}`;

    // Extract bus in-charge
    const inchargeMatch = sec.match(/\*\*Bus\s+in-charge:\*\*\s*([^-]+)---\s*(\d+)/i);
    const inchargeName = inchargeMatch ? inchargeMatch[1].trim().replace(/\s+/g, ' ') : null;
    const inchargePhone = inchargeMatch ? inchargeMatch[2].trim() : null;

    // Parse individual stops
    const stops = [];
    if (rawStopsStr) {
      const parts = rawStopsStr.split(';').map((p) => p.trim()).filter(Boolean);
      for (const part of parts) {
        const lastOpen = part.lastIndexOf('(');
        const lastClose = part.lastIndexOf(')');
        let stopName = part.replace(/\.\s*$/, '').trim();
        let rawTime = '';

        if (lastOpen !== -1 && lastClose > lastOpen) {
          stopName = part.slice(0, lastOpen).replace(/\.\s*$/, '').trim();
          rawTime = part.slice(lastOpen + 1, lastClose).trim();
        }

        if (stopName) {
          const timeStr = parseTime(rawTime);
          stops.push({ name: stopName, time: timeStr, rawTime });
        }
      }
    }

    const firstStop = stops[0]?.name || 'City Origin';
    const routeNoFormatted = isDemo ? 'DEMO' : routeNum.padStart(2, '0');
    const routeTitle = isDemo
      ? 'Demo Route - Demo Start to VBIT Campus'
      : `Route ${routeNum} - ${firstStop} to VBIT Campus`;

    const driverCode = isDemo ? 'DEMO' : `DRV${routeNum.padStart(2, '0')}`;

    routes.push({
      routeNum,
      isDemo,
      routeNo: routeNoFormatted,
      name: routeTitle,
      areaCovered: rawStopsStr,
      driverCode,
      driverName,
      driverPhone,
      inchargeName,
      inchargePhone,
      stops,
      firstStop,
    });
  }

  return routes;
}

async function populateDatabase() {
  console.log('====================================================');
  console.log('🚀 Populating Drivers and RouteServices in Database');
  console.log('====================================================');

  const content = fs.readFileSync(MD_PATH, 'utf8');
  const routes = parseMarkdownRoutes(content);
  console.log(`Parsed ${routes.length} routes from markdown.`);

  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  console.log(`🔑 Generated bcrypt hash for default driver password: "${DEFAULT_PASSWORD}"`);

  // 1. Temporarily clear phone on existing drivers with unique values to avoid collision
  const existingDrivers = await prisma.driver.findMany();
  for (const d of existingDrivers) {
    await prisma.driver.update({
      where: { id: d.id },
      data: { phone: `TEMP_${d.id}_${Date.now()}` }
    });
  }

  // 2. Upsert each Driver and RouteService
  const createdDrivers = [];
  const createdRoutes = [];

  for (const r of routes) {
    // Upsert Driver
    const driver = await prisma.driver.upsert({
      where: { driverCode: r.driverCode },
      update: {
        name: r.driverName,
        phone: r.driverPhone,
        licenseNo: `LIC-${r.driverCode}`,
        passwordHash,
        status: 'ACTIVE',
      },
      create: {
        driverCode: r.driverCode,
        name: r.driverName,
        phone: r.driverPhone,
        licenseNo: `LIC-${r.driverCode}`,
        passwordHash,
        status: 'ACTIVE',
      },
    });
    createdDrivers.push(driver);

    // Upsert RouteService
    const route = await prisma.routeService.upsert({
      where: { routeNo: r.routeNo },
      update: {
        name: r.name,
        areaCovered: r.areaCovered,
        capacity: 52,
        driverId: driver.id,
      },
      create: {
        routeNo: r.routeNo,
        name: r.name,
        areaCovered: r.areaCovered,
        capacity: 52,
        driverId: driver.id,
      },
    });
    createdRoutes.push(route);

    console.log(
      `✅ Route ${r.routeNo.padEnd(4)} -> Driver: ${driver.driverCode.padEnd(8)} (${driver.name}, ${driver.phone})`
    );
  }

  // 3. Ensure VBIT College stop exists
  const existingVbit = await prisma.stop.findFirst({
    where: { name: { contains: 'VBIT', mode: 'insensitive' } },
  });
  if (!existingVbit) {
    await prisma.stop.create({
      data: {
        name: 'VBIT College',
        latitude: 17.4705,
        longitude: 78.7255,
      },
    });
    console.log('📍 Created master stop: VBIT College (17.4705, 78.7255)');
  }

  console.log('====================================================');
  console.log(`🎉 Successfully populated ${createdRoutes.length} Routes and ${createdDrivers.length} Drivers!`);
  console.log(`🔑 All drivers can log in with:`);
  console.log(`   Driver Code: DRV001 to DRV029, DRV031, DRVDEMO`);
  console.log(`   Password:    ${DEFAULT_PASSWORD}`);
  console.log('====================================================');
}

if (process.argv.includes('--dry-run')) {
  runDry().catch(console.error);
} else {
  populateDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Fatal error populating database:', err);
      process.exit(1);
    });
}
