/**
 * Tests for Quick Debate executor handlers.
 *
 * Tests cover 3 contracts that must hold before implementation ships:
 *
 *   Contract 1 — quick_debate_seed happy path:
 *     Llama's reply comment is written, a quick_debate_reply job for GPT-OSS is
 *     queued, a quick_debate_archive job is queued, and quickDebates.status
 *     becomes "debating".
 *
 *   Contract 2 — quick_debate_seed failure path:
 *     When callAgent throws, quickDebates.status becomes "failed" with the error
 *     message set, and no reply comment or downstream queue items are written.
 *
 *   Contract 3 — quick_debate_archive gate check:
 *     When fewer than 2 agent comments exist on the idea, the handler reschedules
 *     itself (inserts a new quick_debate_archive queue item with retryCount+1)
 *     without calling the LLM. quickDebates.status must NOT be set to "complete".
 *
 * These tests intentionally fail before the implementation exists — they define
 * the exact DB state each handler must produce.
 */

import { vi, describe, it, expect, beforeEach } from "vitest";

// ─── Hoisted mocks ────────────────────────────────────────────────────

const mockCallAgent = vi.hoisted(() => vi.fn());

const dbState = vi.hoisted(() => ({
  selectResponses: [] as unknown[][],
  capturedUpdates: [] as Array<{ data: Record<string, unknown> }>,
  capturedInserts: [] as Array<{ table: string; data: Record<string, unknown> }>,
}));

const mockTransaction = vi.hoisted(() =>
  vi.fn().mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) =>
    cb({
      execute: vi.fn().mockResolvedValue([{ id: "item-1" }]),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
      }),
    })
  )
);

let selectCallIdx = 0;
const mockDbSelect = vi.hoisted(() =>
  vi.fn().mockImplementation(() => {
    const idx  = selectCallIdx++;
    const data = dbState.selectResponses[idx] ?? [];
    return {
      from: (_t: unknown) => ({
        where: (_c: unknown) =>
          Object.assign(Promise.resolve(data), {
            orderBy: (_o: unknown) => Promise.resolve(data),
            limit:   (_n: unknown) => Promise.resolve(data),
          }),
        limit:   (_n: unknown) => Promise.resolve(data),
        orderBy: (_o: unknown) => ({
          where: (_c: unknown) => Promise.resolve(data),
        }),
      }),
    };
  })
);

const mockDbUpdate = vi.hoisted(() =>
  vi.fn().mockImplementation(() => ({
    set: (data: Record<string, unknown>) => ({
      where: () => {
        dbState.capturedUpdates.push({ data });
        return Promise.resolve(undefined);
      },
    }),
  }))
);

const mockDbInsert = vi.hoisted(() =>
  vi.fn().mockImplementation((table: unknown) => ({
    values: (data: Record<string, unknown>) => {
      dbState.capturedInserts.push({ table: String(table), data });
      return {
        returning:          vi.fn().mockResolvedValue([{ id: "new-comment-id" }]),
        onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
      };
    },
  }))
);

vi.mock("@/db", () => ({
  db: {
    transaction: mockTransaction,
    select:      mockDbSelect,
    update:      mockDbUpdate,
    insert:      mockDbInsert,
  },
}));

vi.mock("@/lib/agents/providers/index", () => ({
  callAgent: mockCallAgent,
}));

// Mock scheduler so indirect calls (if any) don't escape to real DB
vi.mock("@/lib/agents/scheduler", () => ({
  queueCommentsOnIdea:      vi.fn().mockResolvedValue(undefined),
  queueQualityReview:       vi.fn().mockResolvedValue(undefined),
  queueThemeSelection:      vi.fn().mockResolvedValue(undefined),
  queueDailyIdeas:          vi.fn().mockResolvedValue(undefined),
  queueDailyArchive:        vi.fn().mockResolvedValue(undefined),
  queueWeeklyRollup:        vi.fn().mockResolvedValue(undefined),
  queueMonthlyRollup:       vi.fn().mockResolvedValue(undefined),
  queueDebateReply:         vi.fn().mockResolvedValue(undefined),
  queueConductorIntervention: vi.fn().mockResolvedValue(undefined),
  queueMentionResponse:     vi.fn().mockResolvedValue(undefined),
  queueLabDiscussion:       vi.fn().mockResolvedValue(undefined),
  queueThemeResearch:       vi.fn().mockResolvedValue(undefined),
}));

import { processQueue } from "@/lib/agents/executor";

// ─── Fixtures ─────────────────────────────────────────────────────────

const IDEA_ROW = {
  id:      "idea-1",
  title:   "Should we open-source all AI safety research?",
  content: "Open-sourcing creates transparency but may accelerate misuse. The tradeoff is real and worth examining.",
  context: null,
  userId:  "user-human-abc",
  roomId:  "room-1",
};

const LLAMA_COMMENT = {
  userId:  "ai_llama",
  content: "The open-source argument assumes good-faith actors. That's the structural flaw.",
};

function makeDebateSeedItem(overrides: Record<string, unknown> = {}) {
  return {
    id:              "item-1",
    agentId:         "ai_llama",
    actionType:      "quick_debate_seed",
    roomId:          "room-1",
    targetIdeaId:    "idea-1",
    targetCommentId: null,
    promptContext:   { debateId: "debate-1", ideaId: "idea-1" },
    scheduledFor:    new Date(),
    priority:        1,
    status:          "in_progress",
    executedAt:      null,
    errorMessage:    null,
    resultIdeaId:    null,
    resultCommentId: null,
    createdAt:       new Date(),
    ...overrides,
  };
}

function makeDebateArchiveItem(retryCount = 0) {
  return {
    id:              "item-1",
    agentId:         "ai_archivist",
    actionType:      "quick_debate_archive",
    roomId:          "room-1",
    targetIdeaId:    "idea-1",
    targetCommentId: null,
    promptContext:   { debateId: "debate-1", ideaId: "idea-1", retryCount },
    scheduledFor:    new Date(),
    priority:        1,
    status:          "in_progress",
    executedAt:      null,
    errorMessage:    null,
    resultIdeaId:    null,
    resultCommentId: null,
    createdAt:       new Date(),
  };
}

function resetState() {
  dbState.selectResponses = [];
  dbState.capturedUpdates = [];
  dbState.capturedInserts = [];
  selectCallIdx = 0;
  vi.clearAllMocks();

  mockTransaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) =>
    cb({
      execute: vi.fn().mockResolvedValue([{ id: "item-1" }]),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
      }),
    })
  );

  mockDbSelect.mockImplementation(() => {
    const idx  = selectCallIdx++;
    const data = dbState.selectResponses[idx] ?? [];
    return {
      from: (_t: unknown) => ({
        where: (_c: unknown) =>
          Object.assign(Promise.resolve(data), {
            orderBy: (_o: unknown) => Promise.resolve(data),
            limit:   (_n: unknown) => Promise.resolve(data),
          }),
        limit:   (_n: unknown) => Promise.resolve(data),
      }),
    };
  });

  mockDbUpdate.mockImplementation(() => ({
    set: (data: Record<string, unknown>) => ({
      where: () => {
        dbState.capturedUpdates.push({ data });
        return Promise.resolve(undefined);
      },
    }),
  }));

  mockDbInsert.mockImplementation((table: unknown) => ({
    values: (data: Record<string, unknown>) => {
      dbState.capturedInserts.push({ table: String(table), data });
      return {
        returning:          vi.fn().mockResolvedValue([{ id: "new-comment-id" }]),
        onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
      };
    },
  }));
}

// ─── Test 1: quick_debate_seed — happy path ───────────────────────────
//
// Select call order:
//   0 = aiQueue full rows (processQueue fetches the seed item after claiming it)
//   1 = aiUsage check    (executeItem rate-limit check for ai_llama)
//   2 = quota check      (executeItem daily token budget check)
//   3 = ideas row        (handler fetches the idea to build the prompt)

describe("processQueue — quick_debate_seed: happy path", () => {
  beforeEach(resetState);

  it("writes Llama reply, queues GPT-OSS reply and archive jobs, sets quickDebates.status=debating", async () => {
    dbState.selectResponses = [
      [makeDebateSeedItem()],  // 0: full queue rows
      [],                      // 1: usage check — Llama not rate-limited
      [],                      // 2: quota check
      [IDEA_ROW],              // 3: idea row
    ];

    mockCallAgent.mockResolvedValueOnce(LLAMA_COMMENT.content);

    await processQueue(1);

    // ── Llama's reply comment must be inserted into ideaComments
    const commentInsert = dbState.capturedInserts.find(
      (i) =>
        typeof (i.data as Record<string, unknown>).content === "string" &&
        (i.data as Record<string, unknown>).ideaId === "idea-1" &&
        !("actionType" in i.data)
    );
    expect(commentInsert, "Llama's reply comment was not inserted").toBeDefined();
    expect((commentInsert!.data as Record<string, unknown>).content).toBe(LLAMA_COMMENT.content);
    expect((commentInsert!.data as Record<string, unknown>).userId).toBe("ai_llama");

    // ── GPT-OSS reply queue item must be inserted
    const gptReplyInsert = dbState.capturedInserts.find(
      (i) => (i.data as Record<string, unknown>).actionType === "quick_debate_reply"
    );
    expect(gptReplyInsert, "GPT-OSS reply queue item was not inserted").toBeDefined();
    expect((gptReplyInsert!.data as Record<string, unknown>).agentId).toBe("ai_gpt_oss");

    // ── Archive queue item must be inserted
    const archiveInsert = dbState.capturedInserts.find(
      (i) => (i.data as Record<string, unknown>).actionType === "quick_debate_archive"
    );
    expect(archiveInsert, "Archive queue item was not inserted").toBeDefined();
    expect((archiveInsert!.data as Record<string, unknown>).agentId).toBe("ai_archivist");

    // ── quickDebates.status must become "debating"
    const debatingUpdate = dbState.capturedUpdates.find(
      (u) => u.data.status === "debating"
    );
    expect(debatingUpdate, "quickDebates.status was not set to 'debating'").toBeDefined();
  });
});

// ─── Test 2: quick_debate_seed — failure path ─────────────────────────
//
// When callAgent throws, the handler must set quickDebates.status="failed"
// with the error message, and must NOT write any reply comment or queue items.

describe("processQueue — quick_debate_seed: callAgent throws", () => {
  beforeEach(resetState);

  it("sets quickDebates.status=failed with errorMessage, writes no comment or queue jobs", async () => {
    dbState.selectResponses = [
      [makeDebateSeedItem()],  // 0: full queue rows
      [],                      // 1: usage check
      [],                      // 2: quota check
      [IDEA_ROW],              // 3: idea row
    ];

    mockCallAgent.mockRejectedValueOnce(new Error("Groq connection refused"));

    await processQueue(1);

    // ── quickDebates.status must be "failed" with the error message
    const failedUpdate = dbState.capturedUpdates.find(
      (u) => u.data.status === "failed"
    );
    expect(failedUpdate, "quickDebates.status was not set to 'failed'").toBeDefined();
    expect(String(failedUpdate!.data.errorMessage)).toContain("Groq connection refused");

    // ── No reply comment must have been inserted
    const commentInsert = dbState.capturedInserts.find(
      (i) =>
        typeof (i.data as Record<string, unknown>).content === "string" &&
        !("actionType" in i.data)
    );
    expect(commentInsert, "A reply comment was incorrectly inserted after callAgent threw").toBeUndefined();

    // ── No downstream queue items (reply or archive) must have been inserted
    const replyInsert = dbState.capturedInserts.find(
      (i) => (i.data as Record<string, unknown>).actionType === "quick_debate_reply"
    );
    expect(replyInsert, "GPT-OSS reply job was incorrectly queued after failure").toBeUndefined();

    const archiveInsert = dbState.capturedInserts.find(
      (i) => (i.data as Record<string, unknown>).actionType === "quick_debate_archive"
    );
    expect(archiveInsert, "Archive job was incorrectly queued after failure").toBeUndefined();
  });
});

// ─── Test 3: quick_debate_archive — gate check ────────────────────────
//
// This is the most important test. The archive job fires but GPT-OSS has not
// posted yet — only 1 comment exists (Llama's). The handler must:
//   - NOT call any LLM
//   - Insert a new quick_debate_archive queue item with retryCount incremented
//   - NOT set quickDebates.status to "complete"
//
// Select call order:
//   0 = aiQueue full rows (the archive item)
//   1 = aiUsage check    (executeItem rate-limit check for ai_archivist)
//   2 = ideaComments     (handler fetches comments — only 1 exists, gate not met)

describe("processQueue — quick_debate_archive: reschedules when only one reply exists", () => {
  beforeEach(resetState);

  it("inserts new archive job with retryCount+1 and does NOT call LLM or mark debate complete", async () => {
    dbState.selectResponses = [
      [makeDebateArchiveItem(0)],  // 0: full queue rows — archive item, retryCount=0
      [],                          // 1: usage check — archivist not rate-limited
      [LLAMA_COMMENT],             // 2: ideaComments — only Llama replied, gate not met
    ];

    // callAgent should not be called at all
    mockCallAgent.mockResolvedValue("unexpected LLM call in gate check");

    await processQueue(1);

    // ── LLM must NOT have been called
    expect(mockCallAgent, "LLM was called despite the gate not being met").not.toHaveBeenCalled();

    // ── A new quick_debate_archive queue item must be inserted with retryCount=1
    const rescheduleInsert = dbState.capturedInserts.find(
      (i) => (i.data as Record<string, unknown>).actionType === "quick_debate_archive"
    );
    expect(rescheduleInsert, "No reschedule insert found for quick_debate_archive").toBeDefined();

    const ctx = (rescheduleInsert!.data as Record<string, unknown>).promptContext as Record<string, unknown>;
    expect(ctx.retryCount, "retryCount was not incremented").toBe(1);
    expect(ctx.debateId, "debateId was not preserved in rescheduled job").toBe("debate-1");
    expect(ctx.ideaId,   "ideaId was not preserved in rescheduled job").toBe("idea-1");

    // ── quickDebates.status must NOT be set to "complete"
    const completeUpdate = dbState.capturedUpdates.find(
      (u) => u.data.status === "complete"
    );
    expect(completeUpdate, "quickDebates.status was incorrectly set to 'complete'").toBeUndefined();
  });
});
