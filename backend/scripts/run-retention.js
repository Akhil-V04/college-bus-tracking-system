require('dotenv').config();

const prisma = require('../src/lib/prisma');

function positiveDays(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const now = new Date();
  const sessionCutoff = new Date(now.getTime() - positiveDays(process.env.ADMIN_SESSION_RETENTION_DAYS, 90) * 86_400_000);
  const candidates = {
    expiredRateLimitBuckets: await prisma.rateLimitBucket.count({ where: { resetAt: { lt: now } } }),
    oldInactiveAdminSessions: await prisma.adminSession.count({
      where: {
        expiresAt: { lt: sessionCutoff },
        OR: [{ revokedAt: { not: null } }, { expiresAt: { lt: now } }],
      },
    }),
  };

  let deleted = { expiredRateLimitBuckets: 0, oldInactiveAdminSessions: 0 };
  if (apply) {
    deleted = await prisma.$transaction(async (tx) => {
      const buckets = await tx.rateLimitBucket.deleteMany({ where: { resetAt: { lt: now } } });
      const sessions = await tx.adminSession.deleteMany({
        where: {
          expiresAt: { lt: sessionCutoff },
          OR: [{ revokedAt: { not: null } }, { expiresAt: { lt: now } }],
        },
      });
      return {
        expiredRateLimitBuckets: buckets.count,
        oldInactiveAdminSessions: sessions.count,
      };
    });
  }

  console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', generatedAt: now, candidates, deleted }));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
