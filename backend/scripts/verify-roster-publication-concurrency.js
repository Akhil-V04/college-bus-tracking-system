require('dotenv').config();

const assert = require('node:assert/strict');
const prisma = require('../src/lib/prisma');
const { acquireRosterPublicationLock } = require('../src/lib/rosterPublicationLock');

const suffix = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
const candidateIds = [];

async function publishCandidate(id, delayMs) {
  return prisma.$transaction(async (tx) => {
    await acquireRosterPublicationLock(tx);
    const candidate = await tx.transportRoster.findUnique({ where: { id } });
    assert.equal(candidate?.status, 'DRAFT');
    if (delayMs) await new Promise((resolve) => setTimeout(resolve, delayMs));
    await tx.transportRoster.updateMany({
      where: { id: { in: candidateIds }, status: 'PUBLISHED' },
      data: { status: 'ARCHIVED' },
    });
    return tx.transportRoster.update({
      where: { id },
      data: { status: 'PUBLISHED', publishedAt: new Date() },
    });
  }, { maxWait: 10_000, timeout: 30_000 });
}

async function main() {
  const candidates = await Promise.all([1, 2].map((version) => prisma.transportRoster.create({ data: {
    name: `Concurrent publication candidate ${version}`,
    academicYear: `CONCURRENCY-${suffix}`,
    version,
    status: 'DRAFT',
  } })));
  candidateIds.push(...candidates.map(({ id }) => id));

  const results = await Promise.all([
    publishCandidate(candidateIds[0], 250),
    publishCandidate(candidateIds[1], 0),
  ]);
  const finalStates = await prisma.transportRoster.findMany({
    where: { id: { in: candidateIds } },
    select: { id: true, status: true },
  });
  assert.equal(results.length, 2);
  assert.equal(finalStates.filter(({ status }) => status === 'PUBLISHED').length, 1);
  assert.equal(finalStates.filter(({ status }) => status === 'ARCHIVED').length, 1);

  console.log(JSON.stringify({
    competingPublications: 2,
    serializedByAdvisoryLock: true,
    finalPublished: 1,
    finalArchived: 1,
    existingRostersUntouched: true,
  }));
}

main()
  .finally(async () => {
    if (candidateIds.length) await prisma.transportRoster.deleteMany({ where: { id: { in: candidateIds } } });
    await prisma.$disconnect();
  })
  .catch((error) => {
    console.error(`[roster-publication-concurrency] ${error.message}`);
    process.exitCode = 1;
  });
