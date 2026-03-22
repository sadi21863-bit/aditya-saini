/**
 * lib/justice-cache.ts — v11-justice
 * Redis-backed cache using Upstash (@upstash/redis).
 * TTL-based: uses redis.set() with EX option (seconds).
 */

import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export async function cacheSet(key: string, value: unknown, ttlSeconds = 300) {
  await redis.set(key, JSON.stringify(value), { ex: ttlSeconds });
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const raw = await redis.get<string>(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return raw as unknown as T;
  }
}

export async function cacheDel(key: string) {
  await redis.del(key);
}

// ── Typed helpers ──────────────────────────────────────────────────────────

/** Cache a SimHash result for 10 minutes */
export async function cacheSimHash(ideaId: string, hash: string) {
  await cacheSet(`simhash:${ideaId}`, hash, 600);
}

export async function getCachedSimHash(ideaId: string): Promise<string | null> {
  return cacheGet<string>(`simhash:${ideaId}`);
}

/** Cache feed data for 60 seconds */
export async function cacheFeed(key: string, data: unknown) {
  await cacheSet(`feed:${key}`, data, 60);
}

export async function getCachedFeed<T>(key: string): Promise<T | null> {
  return cacheGet<T>(`feed:${key}`);
}
