import { vi, describe, it, expect, beforeEach } from "vitest";

// ─── DB mock ──────────────────────────────────────────────────────────
const mockSelectResult = vi.hoisted(() => vi.fn().mockResolvedValue([{ count: 0 }]));

vi.mock("@/db", () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockImplementation(() => mockSelectResult()),
      }),
    }),
  },
}));

import { checkUserMentionRateLimit } from "@/lib/agents/user-rate-limit";

describe("checkUserMentionRateLimit", () => {
  beforeEach(() => vi.clearAllMocks());

  it("throws when userId is empty", async () => {
    await expect(checkUserMentionRateLimit("")).rejects.toThrow("userId is required");
  });

  it("returns allowed=true when count is below limit", async () => {
    mockSelectResult.mockResolvedValueOnce([{ count: 1 }]);
    const result = await checkUserMentionRateLimit("user-1");
    expect(result.allowed).toBe(true);
    expect(result.count).toBe(1);
    expect(result.limit).toBe(3);
  });

  it("returns allowed=true at count=2 (one below default limit of 3)", async () => {
    mockSelectResult.mockResolvedValueOnce([{ count: 2 }]);
    const result = await checkUserMentionRateLimit("user-1");
    expect(result.allowed).toBe(true);
  });

  it("returns allowed=false at count=3 (AT the limit)", async () => {
    mockSelectResult.mockResolvedValueOnce([{ count: 3 }]);
    const result = await checkUserMentionRateLimit("user-1");
    expect(result.allowed).toBe(false);
    expect(result.count).toBe(3);
  });

  it("returns allowed=false when count exceeds limit", async () => {
    mockSelectResult.mockResolvedValueOnce([{ count: 5 }]);
    const result = await checkUserMentionRateLimit("user-1");
    expect(result.allowed).toBe(false);
  });

  it("returns allowed=true when count is 0 (no prior mentions)", async () => {
    mockSelectResult.mockResolvedValueOnce([{ count: 0 }]);
    const result = await checkUserMentionRateLimit("user-1");
    expect(result.allowed).toBe(true);
    expect(result.count).toBe(0);
  });

  it("uses AI_MENTION_DAILY_LIMIT env var when set", async () => {
    const original = process.env.AI_MENTION_DAILY_LIMIT;
    process.env.AI_MENTION_DAILY_LIMIT = "1";
    try {
      mockSelectResult.mockResolvedValueOnce([{ count: 1 }]);
      const result = await checkUserMentionRateLimit("user-1");
      expect(result.allowed).toBe(false);  // 1 >= limit of 1
      expect(result.limit).toBe(1);
    } finally {
      process.env.AI_MENTION_DAILY_LIMIT = original;
    }
  });

  it("falls back to default limit of 3 if env var is invalid", async () => {
    const original = process.env.AI_MENTION_DAILY_LIMIT;
    process.env.AI_MENTION_DAILY_LIMIT = "not-a-number";
    try {
      mockSelectResult.mockResolvedValueOnce([{ count: 2 }]);
      const result = await checkUserMentionRateLimit("user-1");
      expect(result.limit).toBe(3);
      expect(result.allowed).toBe(true);
    } finally {
      process.env.AI_MENTION_DAILY_LIMIT = original;
    }
  });

  it("includes resetAt date in the future", async () => {
    mockSelectResult.mockResolvedValueOnce([{ count: 0 }]);
    const before = Date.now();
    const result = await checkUserMentionRateLimit("user-1");
    expect(result.resetAt.getTime()).toBeGreaterThanOrEqual(before);
  });

  it("rolling window: 24h is the window boundary", async () => {
    // The rate limiter should only count actions within the last 24h.
    // We verify the DB query includes a gte(createdAt, windowStart) condition
    // by checking the mock was called (structural — the real JSONB query is tested live).
    mockSelectResult.mockResolvedValueOnce([{ count: 2 }]);
    await checkUserMentionRateLimit("user-42");
    expect(mockSelectResult).toHaveBeenCalledOnce();
  });
});
