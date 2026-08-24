const test = require('node:test');
const assert = require('node:assert/strict');
const { alertHashData, computeRecordHash, verifyChain } = require('../src/lib/hashChain');

function buildRow(id, previousHash, overrides = {}) {
  const row = {
    id,
    tripId: 4,
    predictedEta: new Date('2026-08-24T04:30:00.000Z'),
    triggeredAt: new Date(`2026-08-24T04:0${id}:00.000Z`),
    studentsAffected: [{ rollNo: '22CSE104' }],
    advisorsNotified: [{ id: 2 }],
    previousHash,
    status: 'ACTIVE',
    recoveredAt: null,
    ...overrides,
  };
  row.recordHash = computeRecordHash(alertHashData(row));
  return row;
}

test('alert hash chain validates and detects immutable-data tampering', () => {
  const first = buildRow(1, null);
  const second = buildRow(2, first.recordHash);
  assert.deepEqual(verifyChain([first, second]), { valid: true, count: 2 });

  second.studentsAffected = [{ rollNo: 'CHANGED' }];
  assert.equal(verifyChain([first, second]).valid, false);
});

test('mutable recovery status does not invalidate immutable alert evidence', () => {
  const row = buildRow(1, null);
  row.status = 'RECOVERED';
  row.recoveredAt = new Date('2026-08-24T05:00:00.000Z');
  assert.deepEqual(verifyChain([row]), { valid: true, count: 1 });
});
