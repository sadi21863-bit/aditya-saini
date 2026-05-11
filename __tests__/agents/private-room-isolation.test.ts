import { vi, describe, it, expect, beforeEach } from "vitest";

// ─── Thenable chain helper ────────────────────────────────────────────
// Drizzle queries like `db.select().from(t).where(c)` are awaitable without
// a trailing `.limit()`. The mock must return a thenable, not a plain object.
function thenable(data: unknown[]): Promise<unknown[]> & { limit: () => Promise<unknown[]> } {
  const p = Promise.resolve(data) as Promise<unknown[]> & { limit: () => Promise<unknown[]> };
  p.limit = () => Promise.resolve(data);
  return p;
}

// ─── Mocks ────────────────────────────────────────────────────────────
const capturedInserts: Array<{ table: string; data: Record<string, unknown> }> = [];
const capturedUpdates: Array<Record<string, unknown>> = [];
const mockCallAgent = vi.hoisted(() => vi.fn());

let mockSelectResponses: unknown[][] = [];
let selectCallCount = 0;

const mockTxExecute = vi.hoisted(() => vi.fn().mockResolvedValue([]));
const mockTransaction = vi.hoisted(() =>
  vi.fn().mockImplementation(async (cb: (tx: unknown) => unknown) =>
    cb({
      execute: mockTxExecute,
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
      }),
    })
  )
);

const mockDbSelect = vi.hoisted(() => vi.fn());
const mockDbInsert = vi.hoisted(() => vi.fn());
const mockDbUpdate = vi.hoisted(() => vi.fn());

vi.mock("@/db", () => ({
  db: {
    select:      mockDbSelect,
    insert:      mockDbInsert,
    update:      mockDbUpdate,
    transaction: mockTransaction,
  },
}));

vi.mock("@/lib/auth", () => ({
  getAuthenticatedUserId: vi.fn().mockResolvedValue("test-user-id"),
}));

vi.mock("@/lib/agents/providers/index", () => ({
  callAgent: mockCallAgent,
}));

// ─── Imports (after mocks) ────────────────────────────────────────────
import { submitMentionWithChoice } from "@/app/actions/ai-mention-actions";
import { queueLabDiscussion } from "@/lib/agents/scheduler";
import { processQueue } from "@/lib/agents/executor";

// ─── Reset helpers ────────────────────────────────────────────────────
function resetState(responses: unknown[][] = []) {
  capturedInserts.length = 0;
  capturedUpdates.length = 0;
  mockSelectResponses = responses;
  selectCallCount    = 0;
  vi.clearAllMocks();

  // db.select: each call pops from mockSelectResponses in order
  // Returns a thenable so both `await chain` and `chain.limit()` work
  mockDbSelect.mockImplementation(() => ({
    from: (_t: unknown) => ({
      where: (_c: unknown) => thenable(mockSelectResponses[selectCallCount++] ?? []),
      limit: (_n: number) => Promise.resolve(mockSelectResponses[selectCallCount++] ?? []),
      orderBy: () => ({
        limit: (_n: number) => Promise.resolve(mockSelectResponses[selectCallCount++] ?? []),
      }),
    }),
  }));

  mockDbInsert.mockImplementation((table: unknown) => ({
    values: (data: Record<string, unknown>) => {
      capturedInserts.push({ table: String(table), data });
      return {
        returning:          vi.fn().mockResolvedValue([{ id: "new-id" }]),
        onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
        catch:              vi.fn().mockResolvedValue(undefined),
      };
    },
  }));

  mockDbUpdate.mockImplementation(() => ({
    set: (data: Record<string, unknown>) => {
      capturedUpdates.push(data);
      return { where: vi.fn().mockResolvedValue(undefined) };
    },
  }));

  mockTransaction.mockImplementation(async (cb: (tx: unknown) => unknown) =>
    cb({
      execute: mockTxExecute,
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
      }),
    })
  );
}

// ─── Layer 2: server-action override ─────────────────────────────────
// Calls in submitMentionWithChoice (for @llama — specific, no aiUsage DB call):
//   idx 0 → room lookup
//   idx 1 → checkUserMentionRateLimit (db.select from ai_queue, no .limit())
//   idx 2 → idea lookup

describe("Layer 2 — server action forces echo=private for private rooms", () => {
  it("overrides echoChoice='public' to 'private' when room is private", async () => {
    resetState([
      [{ visibility: "private", isAiLab: false }],          // 0: room
      [{ count: 0 }],                                        // 1: rate limit
      [{ title: "Test idea", content: "Content" }],          // 2: idea
    ]);

    const result = await submitMentionWithChoice({
      roomId:     "private-room",
      ideaId:     "idea-1",
      content:    "@llama what do you think?",
      echoChoice: "public",
    });

    expect(result.success).toBe(true);

    // Isolation audit log should exist
    const isolationLog = capturedInserts.find(
      (i) => (i.data as Record<string, unknown>).verdict === "isolated"
    );
    expect(isolationLog).toBeDefined();
    expect((isolationLog!.data as Record<string, unknown>).moderatorAgentId).toBe("system");
    expect((isolationLog!.data as Record<string, unknown>).targetType).toBe("mention");
    expect(String((isolationLog!.data as Record<string, unknown>).reason ?? "")).toContain("Private room");

    // No lab_discussion row queued
    const labDisc = capturedInserts.find(
      (i) => (i.data as Record<string, unknown>).actionType === "lab_discussion"
    );
    expect(labDisc).toBeUndefined();

    // The mention_response queue row must have echo_to_lab=false and is_private_room=true
    const mentionRow = capturedInserts.find(
      (i) => (i.data as Record<string, unknown>).actionType === "comment"
    );
    expect(mentionRow).toBeDefined();
    const ctx = (mentionRow!.data as Record<string, unknown>).promptContext as Record<string, unknown>;
    expect(ctx.echo_to_lab).toBe(false);
    expect(ctx.is_private_room).toBe(true);
  });
});

// ─── Layer 3: scheduler throws on private room lab_discussion ─────────

describe("Layer 3 — scheduler refuses to queue lab_discussion from private room", () => {
  beforeEach(() => resetState());

  it("throws when is_private_room=true", async () => {
    await expect(
      queueLabDiscussion({
        agentId:           "ai_llama",
        sourceRoomId:      "private-room",
        sourceIdeaId:      "idea-1",
        sourceIdeasummary: "A summary",
        isPrivateRoom:     true,
      })
    ).rejects.toThrow("privacy_isolation");
  });

  it("does NOT throw when is_private_room=false", async () => {
    await expect(
      queueLabDiscussion({
        agentId:           "ai_llama",
        sourceRoomId:      "public-room",
        sourceIdeaId:      "idea-1",
        sourceIdeasummary: "A summary",
        isPrivateRoom:     false,
      })
    ).resolves.not.toThrow();
  });
});

// ─── Layer 4: executor refuses lab_discussion with is_private_room=true

const LAB_DISC_ITEM = {
  id:              "queue-lab-1",
  agentId:         "ai_llama",
  actionType:      "lab_discussion",
  roomId:          "lab-room",
  targetIdeaId:    "idea-src",
  targetCommentId: null,
  promptContext:   {
    kind:                "lab_discussion",
    is_private_room:     true,   // ← executor must catch this
    source_idea_summary: "Some topic",
  },
  scheduledFor:    new Date(),
  priority:        7,
  status:          "in_progress",
  executedAt:      null,
  errorMessage:    null,
  resultIdeaId:    null,
  resultCommentId: null,
  createdAt:       new Date(),
};

describe("Layer 4 — executor refuses lab_discussion with is_private_room=true", () => {
  beforeEach(() => {
    resetState([
      [LAB_DISC_ITEM],  // idx 0: full queue row fetch (after transaction claims it)
      [],               // idx 1: usage check
    ]);
    mockTxExecute.mockResolvedValue([{ id: "queue-lab-1" }]);
    mockCallAgent.mockResolvedValue('{"title":"T","pitch":"P","content":"A long enough content string that exceeds the minimum character limit requirement."}');
  });

  it("marks the queue item failed with private_room_isolation_violated", async () => {
    const result = await processQueue(1);
    expect(result.failed).toBe(1);
    expect(result.processed).toBe(0);
    const failedUpdate = capturedUpdates.find((u) => u.status === "failed");
    expect(failedUpdate).toBeDefined();
    expect(String(failedUpdate?.errorMessage ?? "")).toContain("private_room_isolation_violated");
  });

  it("does NOT call callAgent for a private-room lab_discussion", async () => {
    await processQueue(1);
    expect(mockCallAgent).not.toHaveBeenCalled();
  });

  it("logs to ai_moderation_log with verdict='isolated' and target_type='queue_action'", async () => {
    await processQueue(1);
    const log = capturedInserts.find(
      (i) =>
        (i.data as Record<string, unknown>).verdict    === "isolated" &&
        (i.data as Record<string, unknown>).targetType === "queue_action"
    );
    expect(log).toBeDefined();
    expect((log!.data as Record<string, unknown>).moderatorAgentId).toBe("system");
    expect(String((log!.data as Record<string, unknown>).reason ?? "")).toContain("isolation violated");
  });
});

// ─── End-to-end: private room → no AI Lab idea ───────────────────────

describe("End-to-end: private room mention never creates AI Lab idea", () => {
  it("submitMentionWithChoice in private room → no lab_discussion queued", async () => {
    resetState([
      [{ visibility: "private", isAiLab: false }],
      [{ count: 0 }],
      [{ title: "Idea", content: "Content" }],
    ]);

    const result = await submitMentionWithChoice({
      roomId:     "private-room",
      ideaId:     "idea-1",
      content:    "@scout is this feasible?",
      echoChoice: "public",
    });

    expect(result.success).toBe(true);

    const labRows = capturedInserts.filter(
      (i) => (i.data as Record<string, unknown>).actionType === "lab_discussion"
    );
    expect(labRows).toHaveLength(0);

    const mentionRows = capturedInserts.filter(
      (i) => (i.data as Record<string, unknown>).actionType === "comment"
    );
    for (const row of mentionRows) {
      const ctx = (row.data as Record<string, unknown>).promptContext as Record<string, unknown>;
      expect(ctx.echo_to_lab).toBe(false);
      expect(ctx.is_private_room).toBe(true);
    }
  });
});
