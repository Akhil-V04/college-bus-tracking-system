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
  const acceptedGpsCutoff = new Date(now.getTime() - positiveDays(process.env.RAW_GPS_ACCEPTED_RETENTION_DAYS, 7) * 86_400_000);
  const rejectedGpsCutoff = new Date(now.getTime() - positiveDays(process.env.RAW_GPS_REJECTED_RETENTION_DAYS, 2) * 86_400_000);
  const etaSnapshotCutoff = new Date(now.getTime() - positiveDays(process.env.ETA_CALIBRATION_RETENTION_DAYS, 30) * 86_400_000);
  const acceptedGpsWhere = {
    acceptedForEta: true,
    receivedAt: { lt: acceptedGpsCutoff },
    trip: { status: { in: ['COMPLETED', 'CANCELLED'] }, segmentAggregatedAt: { not: null } },
  };
  const rejectedGpsWhere = {
    acceptedForEta: false,
    receivedAt: { lt: rejectedGpsCutoff },
    trip: { status: { not: 'RUNNING' } },
  };
  const etaSnapshotWhere = { calculatedAt: { lt: etaSnapshotCutoff }, trip: { status: { not: 'RUNNING' } } };
  const candidates = {
    expiredRateLimitBuckets: await prisma.rateLimitBucket.count({ where: { resetAt: { lt: now } } }),
    oldInactiveAdminSessions: await prisma.adminSession.count({
      where: {
        expiresAt: { lt: sessionCutoff },
        OR: [{ revokedAt: { not: null } }, { expiresAt: { lt: now } }],
      },
    }),
    acceptedGpsAfterDerivedEvidence: await prisma.liveLocation.count({ where: acceptedGpsWhere }),
    rejectedGpsDiagnostics: await prisma.liveLocation.count({ where: rejectedGpsWhere }),
    etaCalibrationSnapshots: await prisma.etaCalibrationSnapshot.count({ where: etaSnapshotWhere }),
    expiredPushSubscriptions: await prisma.pushDeviceSubscription.count({
      where: { active: true, expiresAt: { lt: now } },
    }),
  };

  let deleted = {
    expiredRateLimitBuckets: 0,
    oldInactiveAdminSessions: 0,
    acceptedGpsAfterDerivedEvidence: 0,
    rejectedGpsDiagnostics: 0,
    etaCalibrationSnapshots: 0,
    expiredPushSubscriptionsDeactivated: 0,
  };
  if (apply) {
    deleted = await prisma.$transaction(async (tx) => {
      const buckets = await tx.rateLimitBucket.deleteMany({ where: { resetAt: { lt: now } } });
      const sessions = await tx.adminSession.deleteMany({
        where: {
          expiresAt: { lt: sessionCutoff },
          OR: [{ revokedAt: { not: null } }, { expiresAt: { lt: now } }],
        },
      });
      const acceptedGps = await tx.liveLocation.deleteMany({ where: acceptedGpsWhere });
      const rejectedGps = await tx.liveLocation.deleteMany({ where: rejectedGpsWhere });
      const etaSnapshots = await tx.etaCalibrationSnapshot.deleteMany({ where: etaSnapshotWhere });
      const expiredPush = await tx.pushDeviceSubscription.updateMany({
        where: { active: true, expiresAt: { lt: now } },
        data: { active: false },
      });
      return {
        expiredRateLimitBuckets: buckets.count,
        oldInactiveAdminSessions: sessions.count,
        acceptedGpsAfterDerivedEvidence: acceptedGps.count,
        rejectedGpsDiagnostics: rejectedGps.count,
        etaCalibrationSnapshots: etaSnapshots.count,
        expiredPushSubscriptionsDeactivated: expiredPush.count,
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
