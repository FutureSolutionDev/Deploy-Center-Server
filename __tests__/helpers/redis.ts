/**
 * Redis test helper — F-002.
 * Returns a singleton ioredis client pinned to REDIS_DB=1 (test DB index per .env.test)
 * + flushTestRedis() that only flushes this DB (never DB 0 / dev data).
 */

import Redis from 'ioredis';

let cachedRedis: Redis | null = null;

/**
 * Get the test Redis client. Pinned to REDIS_DB from .env.test (default index 1).
 */
export function getTestRedis(): Redis {
  if (cachedRedis) return cachedRedis;

  const db = Number(process.env.REDIS_DB ?? 1);
  if (db === 0) {
    throw new Error(
      'Refusing to use REDIS_DB=0 in tests — likely shared with dev data. ' +
        'Set REDIS_DB=1 (or higher) in .env.test.'
    );
  }

  cachedRedis = new Redis({
    host: process.env.REDIS_HOST ?? 'localhost',
    port: Number(process.env.REDIS_PORT ?? 6379),
    password: process.env.REDIS_PASSWORD || undefined,
    db,
    maxRetriesPerRequest: null, // tests must not throw on transient blip
    lazyConnect: false,
  });
  return cachedRedis;
}

/**
 * FLUSHDB the test-only Redis DB index. Safe — never touches DB 0.
 */
export async function flushTestRedis(): Promise<void> {
  const redis = getTestRedis();
  await redis.flushdb();
}

/**
 * Cleanly close the test Redis connection. Call from afterAll().
 */
export async function closeTestRedis(): Promise<void> {
  if (cachedRedis) {
    await cachedRedis.quit();
    cachedRedis = null;
  }
}
