import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/**
 * FIX #41: Lazy Redis initialization — previously constructed Redis at module load time,
 * which caused ALL rate-limited actions to throw if env vars were missing or Redis was down.
 *
 * Now: Redis is created on first use. If creation or a limit() call fails, we
 * fail open (return { success: true }) so the underlying action still proceeds.
 * This matches the principle: rate limiting is a soft defence, not a hard gate.
 */

let _redis: Redis | null = null;

function getRedis(): Redis {
    if (!_redis) {
        _redis = new Redis({
            url: process.env.UPSTASH_REDIS_REST_URL!,
            token: process.env.UPSTASH_REDIS_REST_TOKEN!,
        });
    }
    return _redis;
}

function makeLimiter(limiter: Ratelimit["limiter"], prefix: string) {
    return {
        limit: async (identifier: string): Promise<{ success: boolean }> => {
            try {
                const redis = getRedis();
                const rl = new Ratelimit({ redis, limiter, analytics: true, prefix });
                return await rl.limit(identifier);
            } catch (err) {
                // Fail open — Redis down / misconfigured should not block all writes
                console.warn(`[ratelimit] Redis unavailable for "${prefix}":`, err);
                return { success: true };
            }
        },
    };
}

// For expensive writes: createIdea, updateIdea, deleteIdea, launchIdea
export const writeLimiter = makeLimiter(
    Ratelimit.slidingWindow(5, "10 s"),
    "ideaconnect:write"
);

// For lighter writes: sparkIdea, requestAccess, bookmarks, follows
export const lightLimiter = makeLimiter(
    Ratelimit.slidingWindow(15, "10 s"),
    "ideaconnect:light"
);
