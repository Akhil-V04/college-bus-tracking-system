require('dotenv').config();

const assert = require('node:assert/strict');
const prisma = require('../src/lib/prisma');
const { PostgresRateLimitStore } = require('../src/lib/postgresRateLimitStore');

async function main() {
  const rawKey = `verification-${Date.now()}`;
  const storeA = new PostgresRateLimitStore({ prisma, prefix: 'verification-login:' });
  const storeB = new PostgresRateLimitStore({ prisma, prefix: 'verification-login:' });
  const isolatedStore = new PostgresRateLimitStore({ prisma, prefix: 'verification-import:' });
  for (const store of [storeA, storeB, isolatedStore]) store.init({ windowMs: 60_000 });

  try {
    assert.equal((await storeA.increment(rawKey)).totalHits, 1);
    assert.equal((await storeB.increment(rawKey)).totalHits, 2, 'separate server instances must share counters');
    assert.equal((await isolatedStore.increment(rawKey)).totalHits, 1, 'limiter prefixes must isolate counters');
    assert.equal((await storeA.get(rawKey)).totalHits, 2);
    await storeB.decrement(rawKey);
    assert.equal((await storeA.get(rawKey)).totalHits, 1);

    const persisted = await prisma.rateLimitBucket.findUnique({ where: { key: storeA.hashedKey(rawKey) } });
    assert.ok(persisted);
    assert.equal(persisted.key.includes(rawKey), false, 'raw client identifiers must not be stored');
    console.log('Shared PostgreSQL rate-limit verification passed.');
  } finally {
    await Promise.all([storeA.resetKey(rawKey), isolatedStore.resetKey(rawKey)]);
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
