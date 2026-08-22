import { vi, describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ─── Mocks ────────────────────────────────────────────────────────────

const mockCallGroq = vi.hoisted(() => vi.fn());
const mockDbQuery = vi.hoisted(() => vi.fn());
const mockDbInsert = vi.hoisted(() => vi.fn());
const mockDbUpdate = vi.hoisted(() => vi.fn());
const mockDbSelect = vi.hoisted(() => vi.fn(() => ({
  from: vi.fn(() => ({
    where: vi.fn(() => Promise.resolve([{ n: 0 }])),
  })),
})));

vi.mock("@/lib/agents/providers/groq", () => ({
  callGroq: mockCallGroq,
}));

vi.mock("@/db", () => ({
  db: {
    query: { users: { findFirst: mockDbQuery } },
    select: mockDbSelect as unknown as (...args: unknown[]) => unknown,
    insert: mockDbInsert as unknown as (...args: unknown[]) => unknown,
    update: mockDbUpdate as unknown as (...args: unknown[]) => unknown,
  },
}));

vi.mock("@/db/schema", () => ({
  debates: {},
  debateParticipants: {},
  debateQuestions: {},
  aiUsage: {},
  users: {},
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(() => ({})),
  count: vi.fn(() => ({})),
  gte: vi.fn(() => ({})),
  and: vi.fn(() => ({})),
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(() => Promise.resolve({ user: { id: "user-1" } })),
}));

// ─── Tests ────────────────────────────────────────────────────────────

describe("POST /api/debates/judge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbQuery.mockResolvedValue(null);
  });

  // We test the judge logic by importing the route handler and calling it.
  // The handler is a Next.js route — we need to construct a mock Request.

  function makeRequest(body: Record<string, unknown>) {
    return new NextRequest("http://localhost:3000/api/debates/judge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("returns single_answer verdict with answer text", async () => {
    mockCallGroq.mockResolvedValueOnce(JSON.stringify({
      verdict: "single_answer",
      reasoning: "This is straightforward.",
      answer: "AI safety becomes theatre when compliance replaces understanding.",
    }));

    // Mock the debate insert to return an id
    const mockInsertChain = {
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([{ id: "debate-1" }]),
    };
    mockDbInsert.mockReturnValueOnce(mockInsertChain);
    // Mock aiUsage insert (rate-limit tracking)
    mockDbInsert.mockReturnValueOnce({ values: vi.fn().mockReturnThis() });

    // Mock the update
    const mockUpdateChain = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(undefined),
    };
    mockDbUpdate.mockReturnValueOnce(mockUpdateChain);

    const { POST } = await import("@/app/api/debates/judge/route");
    const req = makeRequest({ input: "When does AI safety become security theatre?" });
    const res = await POST(req);
    const data = await res.json();

    expect(data.status).toBe("single_answer");
    expect(data.answer).toContain("AI safety");
  });

  it("returns full_debate with two validated agent IDs", async () => {
    mockCallGroq.mockResolvedValueOnce(JSON.stringify({
      verdict: "full_debate",
      reasoning: "This has genuine disagreement.",
      recommended_agents: ["ai_llama", "ai_gpt_oss"],
      recommended_mode: "risk_scan",
    }));

    const mockInsertChain = {
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([{ id: "debate-2" }]),
    };
    mockDbInsert.mockReturnValueOnce(mockInsertChain);
    // Mock aiUsage insert
    mockDbInsert.mockReturnValueOnce({ values: vi.fn().mockReturnThis() });

    const mockUpdateChain = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(undefined),
    };
    mockDbUpdate.mockReturnValueOnce(mockUpdateChain);

    // Second insert for debate participants
    const mockParticipantInsert = {
      values: vi.fn().mockReturnThis(),
    };
    mockDbInsert.mockReturnValueOnce(mockParticipantInsert);

    const { POST } = await import("@/app/api/debates/judge/route");
    const req = makeRequest({ input: "Should AI explain its reasoning?" });
    const res = await POST(req);
    const data = await res.json();

    expect(data.status).toBe("full_debate");
    expect(data.agents).toEqual(["ai_llama", "ai_gpt_oss"]);
    expect(data.mode).toBe("risk_scan");
  });

  it("falls back to default agents when LLM returns invalid IDs", async () => {
    mockCallGroq.mockResolvedValueOnce(JSON.stringify({
      verdict: "full_debate",
      reasoning: "Has tension.",
      recommended_agents: ["ai_nonexistent", "ai_also_fake"],
      recommended_mode: "brainstorm",
    }));

    const mockInsertChain = {
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([{ id: "debate-3" }]),
    };
    mockDbInsert.mockReturnValueOnce(mockInsertChain);
    // Mock aiUsage insert
    mockDbInsert.mockReturnValueOnce({ values: vi.fn().mockReturnThis() });

    const mockUpdateChain = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(undefined),
    };
    mockDbUpdate.mockReturnValueOnce(mockUpdateChain);

    const mockParticipantInsert = {
      values: vi.fn().mockReturnThis(),
    };
    mockDbInsert.mockReturnValueOnce(mockParticipantInsert);

    const { POST } = await import("@/app/api/debates/judge/route");
    const req = makeRequest({ input: "Test debate" });
    const res = await POST(req);
    const data = await res.json();

    expect(data.agents).toEqual(["ai_llama", "ai_maverick"]);
  });
});
