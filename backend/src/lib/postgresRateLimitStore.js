const { createHash } = require('node:crypto');
const prisma = require('./prisma');

class PostgresRateLimitStore {
  constructor(options = {}) {
    this.client = options.prisma || prisma;
    this.prefix = options.prefix || 'rate-limit:';
    this.windowMs = 60_000;
    this.operations = 0;
  }

  init(options) {
    this.windowMs = options.windowMs;
  }

  hashedKey(key) {
    return createHash('sha256').update(this.prefix + String(key)).digest('hex');
  }

  async increment(key) {
    const now = new Date();
    const resetAt = new Date(now.getTime() + this.windowMs);
    const rows = await this.client.$queryRawUnsafe(
      `INSERT INTO "RateLimitBucket" ("key", "hits", "resetAt", "updatedAt")
       VALUES ($1, 1, $2, $3)
       ON CONFLICT ("key") DO UPDATE SET
         "hits" = CASE WHEN "RateLimitBucket"."resetAt" <= $3 THEN 1 ELSE "RateLimitBucket"."hits" + 1 END,
         "resetAt" = CASE WHEN "RateLimitBucket"."resetAt" <= $3 THEN $2 ELSE "RateLimitBucket"."resetAt" END,
         "updatedAt" = $3
       RETURNING "hits", "resetAt"`,
      this.hashedKey(key), resetAt, now
    );
    this.operations += 1;
    if (this.operations % 500 === 0) {
      await this.client.rateLimitBucket.deleteMany({ where: { resetAt: { lt: new Date(now.getTime() - this.windowMs) } } });
    }
    return { totalHits: rows[0].hits, resetTime: rows[0].resetAt };
  }

  async decrement(key) {
    await this.client.rateLimitBucket.updateMany({
      where: { key: this.hashedKey(key), hits: { gt: 0 } },
      data: { hits: { decrement: 1 } },
    });
  }

  async resetKey(key) {
    await this.client.rateLimitBucket.deleteMany({ where: { key: this.hashedKey(key) } });
  }

  async get(key) {
    const bucket = await this.client.rateLimitBucket.findUnique({ where: { key: this.hashedKey(key) } });
    if (!bucket || bucket.resetAt <= new Date()) return undefined;
    return { totalHits: bucket.hits, resetTime: bucket.resetAt };
  }
}

module.exports = { PostgresRateLimitStore };
