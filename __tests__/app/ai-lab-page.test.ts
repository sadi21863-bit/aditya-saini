/**
 * Tests for AI Lab query functions (lib/ai-lab-queries.ts).
 * Query functions are server-side with DB access — we mock @/db.
 */

import { vi, describe, it, expect, beforeEach } from "vitest";

// ─── DB mock ─────────────────────────────────────────────────────────

let mockSelectReturn: unknown[] = [];

function makeChain(data: unknown[]) {
  const chain: Record<string, unknown> = {};
  chain.where    = () => makeChain(data);
  chain.leftJoin = () => makeChain(data);
  chain.orderBy  = () => makeChain(data);
  chain.limit    = () => makeChain(data);
  chain.offset   = () => Promise.resolve(data);
  // Also awaitable directly
  const p = Promise.resolve(data) as Promise<unknown[]> & typeof chain;
  Object.assign(p, chain);
  return p;
}

const mockDbSelect = vi.hoisted(() =>
  vi.fn().mockImplementation(() => ({
    from: (_t: unknown) => makeChain(mockSelectReturn),
  }))
);

vi.mock("@/db", () => ({
  db: { select: mockDbSelect },
}));

import { getTodayTheme, getAILabIdeas, getParticipantActivity, getTodayUTC } from "@/lib/ai-lab-queries";

function resetDb(data: unknown[]) {
  mockSelectReturn = data;
  vi.clearAllMocks();
  mockDbSelect.mockImplementation(() => ({
    from: (_t: unknown) => makeChain(data),
  }));
}

// ─── getTodayUTC ──────────────────────────────────────────────────────

describe("getTodayUTC", () => {
  it("returns a valid ISO date string (yyyy-mm-dd)", () => {
    const date = getTodayUTC();
    expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

// ─── getTodayTheme ────────────────────────────────────────────────────

describe("getTodayTheme", () => {
  beforeEach(() => resetDb([]));

  it("returns null when no theme exists for today", async () => {
    resetDb([]);
    const result = await getTodayTheme("2026-04-29");
    expect(result).toBeNull();
  });

  it("returns the theme row when one exists", async () => {
    const themeRow = { id: "t1", date: "2026-04-29", theme: "AI governance", rationale: null, researchNotes: null, setByAgentId: "ai_theme_setter" };
    resetDb([themeRow]);
    const result = await getTodayTheme("2026-04-29");
    expect(result).not.toBeNull();
    expect(result?.theme).toBe("AI governance");
  });
});

// ─── getAILabIdeas ────────────────────────────────────────────────────

describe("getAILabIdeas", () => {
  beforeEach(() => resetDb([]));

  it("returns empty array when no ideas for today", async () => {
    resetDb([]);
    const result = await getAILabIdeas("2026-04-29");
    expect(result).toHaveLength(0);
  });

  it("maps rows to author shape including isAi flag", async () => {
    const row = {
      id: "idea-1", title: "Test idea", context: null, content: "Content here",
      totalLikes: 3, totalComments: 1, createdAt: new Date("2026-04-29T05:00:00Z"),
      userId: "ai_llama",
      handle: "llama", name: "Llama", isAi: true, aiRole: "participant", avatarUrl: null,
    };
    resetDb([row]);
    const result = await getAILabIdeas("2026-04-29");
    expect(result).toHaveLength(1);
    expect(result[0].author.isAi).toBe(true);
    expect(result[0].author.handle).toBe("llama");
  });

  it("sets isAi=false for human-authored ideas", async () => {
    const row = {
      id: "idea-2", title: "Human idea", context: null, content: "Content",
      totalLikes: 0, totalComments: 0, createdAt: new Date(), userId: "human-user",
      handle: "alice", name: "Alice", isAi: false, aiRole: null, avatarUrl: null,
    };
    resetDb([row]);
    const result = await getAILabIdeas("2026-04-29");
    expect(result[0].author.isAi).toBe(false);
  });

  it("handles null isAi (defaults to false)", async () => {
    const row = {
      id: "idea-3", title: "Null AI", context: null, content: "Content",
      totalLikes: 0, totalComments: 0, createdAt: new Date(), userId: "u1",
      handle: "bob", name: "Bob", isAi: null, aiRole: null, avatarUrl: null,
    };
    resetDb([row]);
    const result = await getAILabIdeas("2026-04-29");
    expect(result[0].author.isAi).toBe(false);
  });
});

// ─── getParticipantActivity ───────────────────────────────────────────

describe("getParticipantActivity", () => {
  it("returns a set of userIds who posted today", async () => {
    resetDb([{ userId: "ai_llama" }, { userId: "ai_qwen" }]);
    const active = await getParticipantActivity("2026-04-29");
    expect(active.has("ai_llama")).toBe(true);
    expect(active.has("ai_qwen")).toBe(true);
    expect(active.has("ai_gpt_oss")).toBe(false);
  });

  it("returns empty set when no ideas posted today", async () => {
    resetDb([]);
    const active = await getParticipantActivity("2026-04-29");
    expect(active.size).toBe(0);
  });
});
