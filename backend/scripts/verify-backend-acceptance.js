const { spawnSync } = require('node:child_process');
const { withConnectionLimit } = require('../src/lib/databaseConnectionPolicy');

const checks = [
  'validate',
  'verify:supabase',
  'verify:database-clean',
  'verify:backup-restore',
  'verify:audit-immutability',
  'verify:adaptive-gps',
  'verify:notification-outbox',
  'verify:api-privacy',
  'verify:socket-isolation',
  'verify:shared-rate-limit',
  'verify:admin-sessions',
  'verify:admin-cookie-auth',
  'verify:release-api',
  'verify:load-limits',
  'verify:google-maps',
  'maintenance:retention',
];

const npmEntryPoint = process.env.npm_execpath;
if (!npmEntryPoint) {
  console.error('[backend-acceptance] run this script through npm so npm_execpath is available');
  process.exit(1);
}
const startedAt = Date.now();
const runtimeUrl = withConnectionLimit(process.env.DATABASE_URL, 1);
const directUrl = withConnectionLimit(process.env.DIRECT_URL, 1);
const retryableChecks = new Set([
  'verify:supabase', 'verify:database-clean', 'verify:backup-restore',
  'verify:audit-immutability', 'verify:notification-outbox', 'verify:api-privacy',
  'verify:socket-isolation', 'verify:shared-rate-limit', 'verify:admin-sessions',
  'verify:admin-cookie-auth', 'verify:release-api', 'verify:load-limits',
  'maintenance:retention',
]);
for (const check of checks) {
  const connectionLimit = check === 'verify:load-limits' ? 5 : 1;
  const checkEnvironment = {
    ...process.env,
    DATABASE_URL: withConnectionLimit(process.env.DATABASE_URL, connectionLimit),
    DIRECT_URL: withConnectionLimit(process.env.DIRECT_URL, connectionLimit),
    DATABASE_CONNECTION_LIMIT: String(connectionLimit),
  };
  const maxAttempts = retryableChecks.has(check) ? 3 : 1;
  let passed = false;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const result = spawnSync(process.execPath, [npmEntryPoint, 'run', check], {
      cwd: process.cwd(),
      env: checkEnvironment,
      encoding: 'utf8',
      shell: false,
      stdio: 'inherit',
      timeout: 180_000,
    });
    if (result.error?.code === 'ETIMEDOUT') {
      console.error(`[backend-acceptance] ${check} exceeded 180 seconds`);
      process.exit(1);
    }
    if (result.error) {
      console.error(`[backend-acceptance] ${check} could not start: ${result.error.message}`);
      process.exit(1);
    }
    if (result.status === 0) {
      passed = true;
      break;
    }
    if (attempt < maxAttempts) {
      console.error(`[backend-acceptance] ${check} attempt ${attempt} failed; retrying`);
    }
  }
  if (!passed) {
    console.error(`[backend-acceptance] ${check} failed after ${maxAttempts} attempt(s)`);
    process.exit(1);
  }
}

console.log(JSON.stringify({
  backendAcceptanceChecks: checks.length,
  status: 'passed',
  durationSeconds: Math.round((Date.now() - startedAt) / 1000),
  excludes: ['restricted Render runtime role', 'real SMTP delivery', 'real Expo device delivery', 'road field validation'],
}));
