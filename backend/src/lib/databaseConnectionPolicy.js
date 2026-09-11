function connectionMode(value) {
  try {
    const url = new URL(value);
    const port = url.port || '5432';
    if (/pooler\.supabase\.com$/i.test(url.hostname)) {
      return port === '6543' ? 'SUPAVISOR_TRANSACTION' :
        port === '5432' ? 'SUPAVISOR_SESSION' : 'SUPAVISOR_UNKNOWN';
    }
    return port === '5432' ? 'DIRECT_OR_STANDARD' : 'STANDARD_CUSTOM_PORT';
  } catch {
    return 'INVALID';
  }
}

function migrationConnectionSupported(value) {
  return ['SUPAVISOR_SESSION', 'DIRECT_OR_STANDARD', 'STANDARD_CUSTOM_PORT'].includes(connectionMode(value));
}

function withDatabaseSchema(value, schema = 'public') {
  if (!value) return value;
  try {
    const url = new URL(value);
    if (!url.searchParams.has('schema')) url.searchParams.set('schema', schema);
    return url.toString();
  } catch {
    return value;
  }
}

function withConnectionLimit(value, limit) {
  if (!value || !Number.isInteger(Number(limit)) || Number(limit) < 1) return value;
  try {
    const url = new URL(value);
    if (!url.searchParams.has('connection_limit')) {
      url.searchParams.set('connection_limit', String(Number(limit)));
    }
    return url.toString();
  } catch {
    return value;
  }
}

module.exports = { connectionMode, migrationConnectionSupported, withConnectionLimit, withDatabaseSchema };
