import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// For expensive writes: createIdea, updateIdea, deleteIdea, launchIdea
export const writeLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, "10 s"),
    analytics: true,
    prefix: "ideaconnect:write",
});

// For lighter writes: sparkIdea, requestAccess, bookmarks, follows
export const lightLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(15, "10 s"),
    analytics: true,
    prefix: "ideaconnect:light",
});
