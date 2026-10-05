const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildAdminAuditData,
  adminAuditHashData,
  changedFields,
  sanitizeAuditSummary,
} = require('../src/lib/adminAudit');
const { computeRecordHash } = require('../src/lib/hashChain');
const { parseAuditQuery } = require('../src/routes/admin-audit-logs');

test('audit summaries remove credentials, phone numbers, and passenger identifiers recursively', () => {
  const sanitized = sanitizeAuditSummary({
    routeNo: '08',
    phone: 'private',
    passwordHash: 'private',
    nested: { email: 'private', rollNo: 'private', capacity: 52 },
  });
  assert.deepEqual(sanitized, { routeNo: '08', nested: { capacity: 52 } });
});

test('audit data uses the authenticated administrator and string entity IDs', () => {
  const data = buildAdminAuditData(
    { user: { id: 'admin' } },
    { action: 'ROUTE_UPDATED', entityType: 'RouteService', entityId: 8, afterSummary: { routeNo: '08' } }
  );
  assert.equal(data.adminIdentifier, 'admin');
  assert.equal(data.entityId, '8');
  assert.deepEqual(data.afterSummary, { routeNo: '08' });
});

test('changedFields reports only allowed fields whose values changed', () => {
  assert.deepEqual(
    changedFields({ name: 'Old', phone: '1', capacity: 40 }, { name: 'New', phone: '2', capacity: 40 }, ['name', 'capacity']),
    ['name']
  );
});

test('administrator audit hash input is deterministic and includes its previous link', () => {
  const row = {
    adminIdentifier: 'admin',
    action: 'ROUTE_UPDATED',
    entityType: 'RouteService',
    entityId: '8',
    beforeSummary: { capacity: 40 },
    afterSummary: { capacity: 45 },
    correlationId: 'request-1',
    createdAt: new Date('2026-09-09T08:00:00.000Z'),
    previousHash: 'previous',
  };
  assert.equal(computeRecordHash(adminAuditHashData(row)), computeRecordHash(adminAuditHashData({ ...row })));
  assert.notEqual(
    computeRecordHash(adminAuditHashData(row)),
    computeRecordHash(adminAuditHashData({ ...row, previousHash: 'changed' }))
  );
});

test('audit query parsing creates exact filters and ISO date bounds', () => {
  const parsed = parseAuditQuery({
    action: 'ROSTER_PUBLISHED',
    entityType: 'TransportRoster',
    entityId: '12',
    from: '2026-08-01T00:00:00+05:30',
  });
  assert.equal(parsed.error, undefined);
  assert.equal(parsed.where.action, 'ROSTER_PUBLISHED');
  assert.equal(parsed.where.entityType, 'TransportRoster');
  assert.equal(parsed.where.entityId, '12');
  assert.equal(parsed.where.createdAt.gte.toISOString(), '2026-07-31T18:30:00.000Z');
});

test('audit query rejects invalid and reversed date ranges', () => {
  assert.match(parseAuditQuery({ from: 'not-a-date' }).error, /invalid/i);
  assert.match(parseAuditQuery({ from: '2026-09-01', to: '2026-08-01' }).error, /from/i);
});
