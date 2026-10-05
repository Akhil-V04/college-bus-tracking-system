require('dotenv').config();

const assert = require('node:assert/strict');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } });

async function expectAppendOnlyRejection(tx, sql, id, operation) {
  const savepoint = `audit_${operation}_probe`;
  await tx.$executeRawUnsafe(`SAVEPOINT ${savepoint}`);
  try {
    await tx.$executeRawUnsafe(sql, id);
  } catch (error) {
    await tx.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT ${savepoint}`);
    assert.match(String(error.message), /AdminAuditLog is append-only/);
    return;
  }
  await tx.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT ${savepoint}`);
  throw new Error(`AdminAuditLog ${operation} unexpectedly succeeded`);
}

async function main() {
  const trigger = await prisma.$queryRaw`
    SELECT t.tgenabled AS enabled
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'AdminAuditLog'
      AND t.tgname = 'AdminAuditLog_append_only'
      AND NOT t.tgisinternal
  `;
  assert.equal(trigger.length, 1, 'append-only audit trigger is missing');
  assert.notEqual(trigger[0].enabled, 'D', 'append-only audit trigger is disabled');

  const before = await prisma.adminAuditLog.findFirst({
    orderBy: { id: 'asc' },
    select: { id: true, action: true, recordHash: true },
  });
  assert.ok(before, 'at least one administrator audit record is required for the mutation probe');

  await prisma.$transaction(async (tx) => {
    await expectAppendOnlyRejection(
      tx,
      'UPDATE "AdminAuditLog" SET "action" = "action" WHERE "id" = $1',
      before.id,
      'update'
    );
    await expectAppendOnlyRejection(
      tx,
      'DELETE FROM "AdminAuditLog" WHERE "id" = $1',
      before.id,
      'delete'
    );
  });

  const after = await prisma.adminAuditLog.findUnique({
    where: { id: before.id },
    select: { id: true, action: true, recordHash: true },
  });
  assert.deepEqual(after, before, 'audit evidence changed during the mutation probes');

  console.log(JSON.stringify({
    appendOnlyTrigger: 'enabled',
    updateRejected: true,
    deleteRejected: true,
    evidenceUnchanged: true,
  }));
}

main()
  .catch((error) => {
    console.error(`[audit-immutability] ${error.message}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
