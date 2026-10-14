async function assertRuntimeIdentity(client, env = process.env) {
  const expectedRole = String(env.EXPECTED_RUNTIME_DB_ROLE || 'bus_tracker_runtime');
  const requireRestricted = env.REQUIRE_RESTRICTED_DB_ROLE === 'true';
  let rows;
  let lastError;
  const maxAttempts = 6;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      rows = await client.$queryRawUnsafe(`
        SELECT current_user AS "currentUser",
          pg_get_userbyid(d.datdba) AS "databaseOwner",
          r.rolsuper AS "isSuperuser",
          r.rolcreatedb AS "canCreateDatabase",
          r.rolcreaterole AS "canCreateRole",
          r.rolbypassrls AS "bypassesRls"
        FROM pg_roles r
        JOIN pg_database d ON d.datname = current_database()
        WHERE r.rolname = current_user
      `);
      if (rows && rows.length > 0) break;
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts) {
        console.warn(`[runtimeIdentity] DB connect attempt ${attempt}/${maxAttempts} failed (${err.code || 'TIMEOUT'}). Retrying in ${attempt * 2}s...`);
        await new Promise((res) => setTimeout(res, attempt * 2000));
      }
    }
  }

  if (!rows && lastError) throw lastError;
  const role = rows?.[0];
  if (!role) throw new Error('Database runtime identity metadata is unavailable');
  if (requireRestricted && (
    role.currentUser !== expectedRole ||
    role.currentUser === role.databaseOwner ||
    role.isSuperuser || role.canCreateDatabase || role.canCreateRole || role.bypassesRls
  )) {
    throw new Error('Database connection does not use the required restricted runtime identity');
  }
  return { restricted: requireRestricted, expectedRoleMatched: role.currentUser === expectedRole };
}

module.exports = { assertRuntimeIdentity };
