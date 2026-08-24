const crypto = require('crypto');

// A minimal SHA-256 hash chain for the LateAlert table.
//
// Each alert stores recordHash = SHA-256 of its own data (including the
// previousHash link). The next alert stores that hash in previousHash, forming
// a chain: alter any past row and its recordHash changes, which no longer
// matches the next row's stored previousHash — tampering is detectable by
// recomputing every row (see verifyChain).

function sha256(input) {
  return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
}

// Deterministic canonical string for any JSON-able value: object keys sorted
// recursively, dates normalised to ISO-8601. Two rows with the same content
// always produce the same string.
function canonicalize(value) {
  if (value === null || value === undefined) return 'null';
  if (value instanceof Date) return value.toISOString();
  if (typeof value !== 'object') return String(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  return `{${Object.keys(value)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canonicalize(value[k])}`)
    .join(',')}}`;
}

function computeRecordHash(data) {
  return sha256(canonicalize(data));
}

// Verifies a chain of rows. Each row must link to the previous row's
// recordHash and re-hash to its own stored recordHash.
function verifyChain(rows) {
  let prevHash = null;
  for (const row of rows) {
    if (row.previousHash !== prevHash) {
      return { valid: false, id: row.id, reason: 'broken link to previous alert' };
    }
    const { id, recordHash, ...data } = row;
    if (computeRecordHash(data) !== recordHash) {
      return { valid: false, id, reason: 'recordHash does not match row data' };
    }
    prevHash = recordHash;
  }
  return { valid: true, count: rows.length };
}

module.exports = { sha256, canonicalize, computeRecordHash, verifyChain };
