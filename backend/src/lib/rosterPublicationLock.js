const ROSTER_PUBLICATION_LOCK_ID = 753423;

async function acquireRosterPublicationLock(client) {
  await client.$queryRawUnsafe(
    'SELECT 1::int AS locked FROM (SELECT pg_advisory_xact_lock($1)) AS acquired',
    ROSTER_PUBLICATION_LOCK_ID
  );
}

module.exports = { ROSTER_PUBLICATION_LOCK_ID, acquireRosterPublicationLock };
