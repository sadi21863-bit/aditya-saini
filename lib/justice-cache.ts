/**
 * lib/justice-cache.ts
 *
 * Simple in-memory audit result cache.
 * Replaces the @upstash/redis dependency which is not installed.
 * Drop-in swap: same get/set API. TTL is approximate (checked on get).
 *
 * To upgrade to Redis later:
 *   npm install @upstash/redis
 *   Then replace this file with the Redis-backed version.
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const store = new Map<string, CacheEntry<unknown>>();

export const justiceCache = {
  async get<T>(key: string): Promise<T | null> {
    const entry = store.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) { store.delete(key); return null; }
    return entry.value;
  },

  async set<T>(key: string, value: T, ttlSeconds = 300): Promise<void> {
    store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  },

  async del(key: string): Promise<void> {
    store.delete(key);
  },
};
