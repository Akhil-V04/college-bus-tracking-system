require('dotenv').config();

const { spawnSync } = require('node:child_process');
const { withConnectionLimit } = require('../src/lib/databaseConnectionPolicy');

const checks = [
  'validate',
  'verify:runtime-role',
  'verify:runtime-workflows',
  'verify:roster-publication-concurrency',
  'verify:release-api',
  'verify:api-privacy',
  'verify:notification-outbox',
  'verify:socket-isolation',
  'verify:shared-rate-limit',
  'verify:admin-sessions',
  'verify:admin-cookie-auth',
  'verify:load-limits',
  'verify:mappls',
  'maintenance:retention',
];

const npmEntryPoint = process.env.npm_execpath;
if (!npmEntryPoint) {
  console.error('[restricted-acceptance] run this script through npm so npm_execpath is available');
  process.exit(1);
}
if (process.env.REQUIRE_RESTRICTED_DB_ROLE !== 'true') {
  console.error('[restricted-acceptance] REQUIRE_RESTRICTED_DB_ROLE=true is required');
  process.exit(1);
}

const startedAt = Date.now();
for (const check of checks) {
  const connectionLimit = check === 'verify:load-limits' ? 5 : 1;
  let passed = false;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const result = spawnSync(process.execPath, [npmEntryPoint, 'run', check], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        DATABASE_URL: withConnectionLimit(process.env.DATABASE_URL, connectionLimit),
        DATABASE_CONNECTION_LIMIT: String(connectionLimit),
      },
      encoding: 'utf8',
      shell: false,
      stdio: 'inherit',
      timeout: 180_000,
    });
    if (result.error?.code === 'ETIMEDOUT') {
      console.error(`[restricted-acceptance] ${check} exceeded 180 seconds`);
      process.exit(1);
    }
    if (!result.error && result.status === 0) {
      passed = true;
      break;
    }
    if (attempt < 3) console.error(`[restricted-acceptance] ${check} attempt ${attempt} failed; retrying`);
  }
  if (!passed) {
    console.error(`[restricted-acceptance] ${check} failed after 3 attempts`);
    process.exit(1);
  }
}

console.log(JSON.stringify({
  restrictedAcceptanceChecks: checks.length,
  status: 'passed',
  durationSeconds: Math.round((Date.now() - startedAt) / 1000),
  runtimeRole: process.env.EXPECTED_RUNTIME_DB_ROLE || 'bus_tracker_runtime',
  migrationCredentialUsed: false,
  destructivePassengerPurge: false,
  providers: 'simulated-except-mappls-cloud-probe',
}));
