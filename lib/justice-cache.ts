/**
 * lib/justice-cache.ts — v11-justice
 * Lightweight in-memory cache for SimHash + feed queries.
 * Drop-in Redis replacement: swap get/set with ioredis when ready.
 */

const cache = new Map<string, { value: unknown; expiresAt: number }>();

export function cacheSet(key: string, value: unknown, ttlSeconds = 300) {
    cache.set(key, {
        value,
        expiresAt: Date.now() + ttlSeconds * 1000,
    });
}

export function cacheGet<T>(key: string): T | null {
    const entry = cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
        cache.delete(key);
        return null;
    }
    return entry.value as T;
}

export function cacheDel(key: string) {
    cache.delete(key);
}

export function cacheFlush() {
    cache.clear();
}

// ── Typed helpers ──────────────────────────────────────────────────────────

/** Cache a SimHash result for 10 minutes */
export function cacheSimHash(ideaId: string, hash: string) {
    cacheSet(`simhash:${ideaId}`, hash, 600);
}

export function getCachedSimHash(ideaId: string): string | null {
    return cacheGet<string>(`simhash:${ideaId}`);
}

/** Cache feed data for 60 seconds */
export function cacheFeed(key: string, data: unknown) {
    cacheSet(`feed:${key}`, data, 60);
}

export function getCachedFeed<T>(key: string): T | null {
    return cacheGet<T>(`feed:${key}`);
}
