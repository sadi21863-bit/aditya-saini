/**
 * lib/ratelimit.ts — v13
 *
 * In-memory sliding window rate limiter.
 * Works correctly on single-instance deployments (local dev, single Vercel function).
 * For multi-instance production: swap the Map for Upstash Redis by replacing
 * the `slidingWindow` function with @upstash/ratelimit calls.
 *
 * To migrate to Upstash:
 *   1. npm install @upstash/ratelimit @upstash/redis
 *   2. Replace this file with the Upstash implementation
 *   3. All callers stay identical — same .limit(key) interface
 *
 * writeLimiter: 10 writes per user per minute
 * lightLimiter: 30 reads/light-ops per user per minute
 */

type WindowEntry = { timestamps: number[] };
const store = new Map<string, WindowEntry>();

function slidingWindow(
  key: string,
  maxRequests: number,
  windowMs: number
): { success: boolean } {
  const now = Date.now();
  const entry = store.get(key) ?? { timestamps: [] };

  // Evict timestamps outside the window
  entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);

  if (entry.timestamps.length >= maxRequests) {
    store.set(key, entry);
    return { success: false };
  }

  entry.timestamps.push(now);
  store.set(key, entry);
  return { success: true };
}

// Prune the store every 5 minutes to prevent unbounded memory growth
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      entry.timestamps = entry.timestamps.filter((t) => now - t < 60_000);
      if (entry.timestamps.length === 0) store.delete(key);
    }
  }, 5 * 60 * 1000);
}

export const writeLimiter = {
  /** 10 write operations per user per 60 seconds */
  limit: async (key: string): Promise<{ success: boolean }> =>
    slidingWindow(`write:${key}`, 10, 60_000),
};

export const lightLimiter = {
  /** 30 light operations per user per 60 seconds */
  limit: async (key: string): Promise<{ success: boolean }> =>
    slidingWindow(`light:${key}`, 30, 60_000),
};
