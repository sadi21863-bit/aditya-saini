/**
 * lib/ratelimit.ts — v12 no-op shim
 *
 * Upstash / Redis has been removed from the v12 stack.
 * All files that previously imported writeLimiter or lightLimiter
 * continue to work unchanged — limit() always succeeds.
 * No network calls, no env vars required.
 */

const noop = {
  limit: async (_key: string): Promise<{ success: boolean }> => ({
    success: true,
  }),
};

export const writeLimiter = noop;
export const lightLimiter = noop;
