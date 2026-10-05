const { PrismaClient } = require('@prisma/client');
const { withConnectionLimit, withDatabaseSchema } = require('./databaseConnectionPolicy');

const schemaUrl = withDatabaseSchema(process.env.DATABASE_URL, 'public');
const configuredLimit = Number(process.env.DATABASE_CONNECTION_LIMIT || 5);
const databaseUrl = withConnectionLimit(schemaUrl, configuredLimit);
const prisma = new PrismaClient(databaseUrl ? { datasources: { db: { url: databaseUrl } } } : undefined);

module.exports = prisma;
