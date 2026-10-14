const { PrismaClient } = require('@prisma/client');
const { withConnectionLimit, withDatabaseSchema } = require('./databaseConnectionPolicy');

const schemaUrl = withDatabaseSchema(process.env.DATABASE_URL, 'public');
const configuredLimit = Number(process.env.DATABASE_CONNECTION_LIMIT || 5);
const databaseUrl = withConnectionLimit(schemaUrl, configuredLimit);
const prisma = new PrismaClient(databaseUrl ? { datasources: { db: { url: databaseUrl } } } : undefined);

// Wrap $transaction to provide resilient timeouts for remote/pooled connections (e.g., Supabase PgBouncer)
const rawTransaction = prisma.$transaction.bind(prisma);
prisma.$transaction = function (arg, options) {
  if (typeof arg === 'function') {
    const mergedOptions = {
      maxWait: 15000,
      timeout: 30000,
      ...options,
    };
    return rawTransaction(arg, mergedOptions);
  }
  return rawTransaction(arg, options);
};

module.exports = prisma;
