const { PrismaClient } = require('@prisma/client');
const { withConnectionLimit, withDatabaseSchema } = require('./databaseConnectionPolicy');

function withResilientTimeouts(urlStr) {
  if (!urlStr) return urlStr;
  try {
    const url = new URL(urlStr);
    if (!url.searchParams.has('connect_timeout')) url.searchParams.set('connect_timeout', '45');
    if (!url.searchParams.has('pool_timeout')) url.searchParams.set('pool_timeout', '60');
    return url.toString();
  } catch {
    return urlStr;
  }
}

const schemaUrl = withDatabaseSchema(process.env.DATABASE_URL, 'public');
const configuredLimit = Number(process.env.DATABASE_CONNECTION_LIMIT || 15);
const databaseUrl = withResilientTimeouts(withConnectionLimit(schemaUrl, configuredLimit));
const prisma = new PrismaClient(databaseUrl ? { datasources: { db: { url: databaseUrl } } } : undefined);

// Transient error auto-retry middleware
const RETRYABLE_CODES = new Set(['P1001', 'P1017', 'P2024', 'P2028']);
prisma.$use(async (params, next) => {
  let attempts = 0;
  const maxAttempts = 3;
  while (attempts < maxAttempts) {
    try {
      attempts++;
      return await next(params);
    } catch (error) {
      const isRetryable =
        RETRYABLE_CODES.has(error?.code) ||
        (error?.message && (
          error.message.includes("Can't reach database server") ||
          error.message.includes('Timed out fetching a new connection') ||
          error.message.includes('Server has closed the connection') ||
          error.message.includes('connection pool')
        ));

      if (isRetryable && attempts < maxAttempts) {
        const delayMs = attempts * 300;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }
      throw error;
    }
  }
});

// Wrap $transaction to provide resilient timeouts for remote/pooled connections (e.g., Supabase PgBouncer)
const rawTransaction = prisma.$transaction.bind(prisma);
prisma.$transaction = function (arg, options) {
  if (typeof arg === 'function') {
    const mergedOptions = {
      maxWait: 20000,
      timeout: 45000,
      ...options,
    };
    return rawTransaction(arg, mergedOptions);
  }
  return rawTransaction(arg, options);
};

module.exports = prisma;
