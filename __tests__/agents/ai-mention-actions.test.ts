import { vi, describe, it, expect, beforeEach } from "vitest";

// ─── Mocks ────────────────────────────────────────────────────────────
const capturedInserts: Array<{ table: string; data: Record<string, unknown> }> = [];

// These are hoisted so they can be used inside vi.mock() factories
const mockGetAuth             = vi.hoisted(() => vi.fn());
const mockExtractMentions     = vi.hoisted(() => vi.fn());
const mockCheckRateLimit      = vi.hoisted(() => vi.fn());
const mockQueueMentionResponse = vi.hoisted(() => vi.fn());
const mockQueueLabDiscussion   = vi.hoisted(() => vi.fn());
const mockDbInsert             = vi.hoisted(() => vi.fn());
const mockDbSelect             = vi.hoisted(() => vi.fn());

vi.mock("@/db", () => ({
  db: {
    select: mockDbSelect,
    insert: mockDbInsert,
  },
}));

vi.mock("@/lib/auth", () => ({
  getAuthenticatedUserId: mockGetAuth,
}));

vi.mock("@/lib/agents/mentions", () => ({
  extractAIMentions: mockExtractMentions,
}));

vi.mock("@/lib/agents/user-rate-limit", () => ({
  checkUserMentionRateLimit: mockCheckRateLimit,
}));

vi.mock("@/lib/agents/scheduler", () => ({
  queueMentionResponse: mockQueueMentionResponse,
  queueLabDiscussion:   mockQueueLabDiscussion,
}));

import { submitMentionWithChoice } from "@/app/actions/ai-mention-actions";

// ─── Per-test setup helpers ───────────────────────────────────────────

function setupDefaults() {
  mockGetAuth.mockReset().mockResolvedValue("user-123");
  mockExtractMentions.mockReset();  // must be set per-test
  mockCheckRateLimit.mockReset().mockResolvedValue({
    allowed: true, count: 0, limit: 3, resetAt: new Date(),
  });
  mockQueueMentionResponse.mockReset().mockResolvedValue(undefined);
  mockQueueLabDiscussion.mockReset().mockResolvedValue(undefined);
  capturedInserts.length = 0;

  mockDbInsert.mockReset().mockImplementation((table: unknown) => ({
    values: (data: Record<string, unknown>) => {
      capturedInserts.push({ table: String(table), data });
      return {
        returning: vi.fn().mockResolvedValue([{ id: "new-comment-id" }]),
        catch:     vi.fn().mockResolvedValue(undefined),
      };
    },
  }));
}

// Sets db.select to always return a specific room
function withRoom(visibility: "public" | "private") {
  mockDbSelect.mockReset().mockImplementation(() => ({
    from: () => ({
      // .where().limit() chain (room/idea lookups)
      where: () => ({
        limit: () => Promise.resolve([{ visibility, isAiLab: false }]),
      }),
      limit: () => Promise.resolve([]),
    }),
  }));
}

const LLAMA = { agentId: "ai_llama",   agentHandle: "llama",   isRandomSelection: false };
const GPTOSS = { agentId: "ai_gpt_oss", agentHandle: "gpt-oss", isRandomSelection: false };
const QWEN   = { agentId: "ai_qwen",    agentHandle: "qwen",    isRandomSelection: false };

// ─── Tests ────────────────────────────────────────────────────────────

describe("submitMentionWithChoice — auth", () => {
  beforeEach(setupDefaults);

  it("returns unauthenticated when user is not logged in", async () => {
    mockGetAuth.mockResolvedValueOnce(null);
    mockExtractMentions.mockResolvedValueOnce([]);
    const r = await submitMentionWithChoice({
      roomId: "r1", ideaId: "i1", content: "@llama?", echoChoice: "private",
    });
    expect(r.error).toBe("unauthenticated");
  });
});

describe("submitMentionWithChoice — mention detection", () => {
  beforeEach(setupDefaults);

  it("returns no_ai_mentions_found when text has no @agent handles", async () => {
    mockExtractMentions.mockResolvedValueOnce([]);
    const r = await submitMentionWithChoice({
      roomId: "r1", ideaId: "i1", content: "no mentions", echoChoice: "private",
    });
    expect(r.error).toBe("no_ai_mentions_found");
  });
});

describe("submitMentionWithChoice — rate limiting", () => {
  beforeEach(() => {
    setupDefaults();
    withRoom("public");
  });

  it("blocks at 4th mention — returns rate_limit_exceeded", async () => {
    mockExtractMentions.mockResolvedValueOnce([LLAMA]);
    mockCheckRateLimit.mockResolvedValueOnce({
      allowed: false, count: 3, limit: 3, resetAt: new Date(Date.now() + 60_000),
    });

    const r = await submitMentionWithChoice({
      roomId: "r1", ideaId: "i1", content: "@llama?", echoChoice: "private",
    });

    expect(r.success).toBe(false);
    expect(r.error).toBe("rate_limit_exceeded");
    expect(r.resetAt).toBeDefined();
    expect(mockQueueMentionResponse).not.toHaveBeenCalled();
  });

  it("allows at count=2 (below default limit of 3)", async () => {
    mockExtractMentions.mockResolvedValueOnce([LLAMA]);
    mockCheckRateLimit.mockResolvedValueOnce({
      allowed: true, count: 2, limit: 3, resetAt: new Date(),
    });

    const r = await submitMentionWithChoice({
      roomId: "r1", ideaId: "i1", content: "@llama?", echoChoice: "private",
    });

    expect(r.success).toBe(true);
    expect(mockQueueMentionResponse).toHaveBeenCalledOnce();
  });
});

describe("submitMentionWithChoice — queueing logic", () => {
  beforeEach(() => {
    setupDefaults();
    withRoom("public");
  });

  it("queues exactly one mention_response per resolved agent", async () => {
    mockExtractMentions.mockResolvedValueOnce([LLAMA, GPTOSS]);

    const r = await submitMentionWithChoice({
      roomId: "r1", ideaId: "i1", content: "@llama @gpt-oss thoughts?", echoChoice: "private",
    });

    expect(r.success).toBe(true);
    expect(r.queued).toBe(2);
    expect(r.mentionedAgents).toEqual(expect.arrayContaining(["llama", "gpt-oss"]));
    expect(mockQueueMentionResponse).toHaveBeenCalledTimes(2);
  });

  it("public-room public-choice creates a lab_discussion queue row per agent", async () => {
    mockExtractMentions.mockResolvedValueOnce([LLAMA]);

    await submitMentionWithChoice({
      roomId: "r1", ideaId: "i1", content: "@llama?", echoChoice: "public",
    });

    expect(mockQueueLabDiscussion).toHaveBeenCalledOnce();
    const ctx = mockQueueLabDiscussion.mock.calls[0][0] as Record<string, unknown>;
    expect(ctx.isPrivateRoom).toBe(false);
  });

  it("public-room private-choice does NOT queue lab_discussion", async () => {
    mockExtractMentions.mockResolvedValueOnce([LLAMA]);

    await submitMentionWithChoice({
      roomId: "r1", ideaId: "i1", content: "@llama?", echoChoice: "private",
    });

    expect(mockQueueLabDiscussion).not.toHaveBeenCalled();
  });

  it("private-room any-choice NEVER queues lab_discussion", async () => {
    withRoom("private");
    mockExtractMentions.mockResolvedValueOnce([QWEN]);

    await submitMentionWithChoice({
      roomId: "r1", ideaId: "i1", content: "@qwen?", echoChoice: "public",
    });

    expect(mockQueueLabDiscussion).not.toHaveBeenCalled();
  });

  it("private-room sets echo_to_lab=false and is_private_room=true in queue context", async () => {
    withRoom("private");
    mockExtractMentions.mockResolvedValueOnce([QWEN]);

    await submitMentionWithChoice({
      roomId: "r1", ideaId: "i1", content: "@qwen?", echoChoice: "public",
    });

    expect(mockQueueMentionResponse).toHaveBeenCalledOnce();
    const ctx = mockQueueMentionResponse.mock.calls[0][0] as Record<string, unknown>;
    expect(ctx.echoToLab).toBe(false);
    expect(ctx.isPrivateRoom).toBe(true);
  });

  it("multiple agents from a single comment each get mention_response + lab_discussion when public", async () => {
    mockExtractMentions.mockResolvedValueOnce([LLAMA, QWEN]);

    await submitMentionWithChoice({
      roomId: "r1", ideaId: "i1", content: "@llama @qwen", echoChoice: "public",
    });

    expect(mockQueueMentionResponse).toHaveBeenCalledTimes(2);
    expect(mockQueueLabDiscussion).toHaveBeenCalledTimes(2);
  });
});
