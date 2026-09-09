function positiveBoundedInteger(value, fallback, maximum) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) return fallback;
  return Math.min(parsed, maximum);
}

function resolveDeploymentPolicy(env = process.env) {
  const production = env.NODE_ENV === 'production';
  const configuredHops = env.TRUST_PROXY_HOPS;
  if (production && configuredHops === undefined) {
    throw new Error('TRUST_PROXY_HOPS must be explicitly configured in production');
  }
  const trustProxyHops = positiveBoundedInteger(configuredHops, 0, 5);
  const rateLimitStore = String(env.RATE_LIMIT_STORE || (production ? 'postgres' : 'memory')).toLowerCase();
  if (!['memory', 'postgres'].includes(rateLimitStore)) throw new Error('RATE_LIMIT_STORE must be memory or postgres');
  if (production && rateLimitStore !== 'postgres') throw new Error('Production requires RATE_LIMIT_STORE=postgres');
  return { production, trustProxyHops, rateLimitStore };
}

module.exports = { positiveBoundedInteger, resolveDeploymentPolicy };
