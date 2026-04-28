/**
 * Tests for the rollup_week executor path (Week 4 Step 5).
 * Uses the same DB-mock pattern as executor-archive-qc.test.ts.
 */

import { vi, describe, it, expect, beforeEach } from "vitest";

const mockCallAgent = vi.hoisted(() => vi.fn());

const dbState = vi.hoisted(() => ({
  selectResponses: [] as unknown[][],
  capturedInserts: [] as Array<{ table: string; data: Record<string, unknown> }>,
  capturedUpdates: [] as Array<{ data: Record<string, unknown> }>,
}));

const mockTransaction = vi.hoisted(() =>
  vi.fn().mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) =>
    cb({
      execute: vi.fn().mockResolvedValue([{ id: "item-1" }]),
      update:  vi.fn().mockReturnValue({
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
        where:   (_c: unknown) => ({
          orderBy: () => Promise.resolve(data),
        }),
        orderBy: () => ({ limit: () => Promise.resolve(data) }),
        limit:   () => Promise.resolve(data),
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
        returning:          vi.fn().mockResolvedValue([{ id: "new-rollup-id" }]),
        onConflictDoUpdate: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: "new-rollup-id" }]),
        }),
      };
    },
  }))
);

vi.mock("@/db", () => ({
  db: { transaction: mockTransaction, select: mockDbSelect, update: mockDbUpdate, insert: mockDbInsert },
}));

vi.mock("@/lib/agents/providers/index", () => ({
  callAgent: mockCallAgent,
}));

import { processQueue } from "@/lib/agents/executor";

// ─── Fixtures ─────────────────────────────────────────────────────────

const ARCHIVIST_RESPONSE = JSON.stringify({
  theme:            "Weekly synthesis",
  narrative_arc:    "The week's discussion centered on federated learning tradeoffs across three days of debate.",
  key_disagreements: [{ between: ["llama", "qwen"], topic: "Feasibility", resolution: "unresolved" }],
  key_questions:    ["Is federated learning practical at scale?"],
  memorable_quotes: [{ agent: "llama", text: "This will fail at scale.", context: "Day 2" }],
  stats:            { ideas_count: 6, comments_count: 18, participants_active: 3, longest_thread_idea_id: null },
});

function makePublishedArchive(date: string) {
  return {
    id:               `archive-${date}`,
    date,
    theme:            `Theme for ${date}`,
    summaryMarkdown:  "Summary.",
    narrativeArc:     `Narrative for ${date}.`,
    keyDisagreements: [],
    keyQuestions:     [],
    memorableQuotes:  [],
    stats:            {},
    status:           "published",
    publishedAt:      new Date(),
    flaggedReason:    null,
    reviewedByAgentId: null,
    reviewedAt:       null,
    generatedAt:      new Date(),
    topDiscussionIdeaId: null,
  };
}

function makeWeekQueueItem() {
  return {
    id:              "item-1",
    agentId:         "ai_archivist",
    actionType:      "rollup_week",
    roomId:          "lab-room",
    targetIdeaId:    null,
    targetCommentId: null,
    promptContext:   { periodStart: "2026-04-19", periodEnd: "2026-04-25" },
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
  dbState.capturedInserts = [];
  dbState.capturedUpdates = [];
  selectCallIdx = 0;
  vi.clearAllMocks();

  mockTransaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) =>
    cb({
      execute: vi.fn().mockResolvedValue([{ id: "item-1" }]),
      update:  vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
      }),
    })
  );

  mockDbSelect.mockImplementation(() => {
    const idx  = selectCallIdx++;
    const data = dbState.selectResponses[idx] ?? [];
    return {
      from: (_t: unknown) => ({
        where: (_c: unknown) => Object.assign(Promise.resolve(data), {
          orderBy: () => Promise.resolve(data),
        }),
        orderBy: () => ({ limit: () => Promise.resolve(data) }),
        limit:   () => Promise.resolve(data),
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
        returning:          vi.fn().mockResolvedValue([{ id: "new-rollup-id" }]),
        onConflictDoUpdate: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: "new-rollup-id" }]),
        }),
      };
    },
  }));
}

// select call order for rollup_week:
// 0 = aiQueue full rows, 1 = aiUsage check, 2 = aiLabArchives (published in period)

describe("processQueue — rollup_week: inserts weekly rollup as draft", () => {
  beforeEach(resetState);

  it("inserts ai_lab_rollups with periodType='weekly' and status='draft'", async () => {
    dbState.selectResponses = [
      [makeWeekQueueItem()],
      [],   // not rate-limited
      [makePublishedArchive("2026-04-21"), makePublishedArchive("2026-04-22"), makePublishedArchive("2026-04-23")],
    ];
    mockCallAgent.mockResolvedValueOnce(ARCHIVIST_RESPONSE);

    await processQueue(1);

    const rollupInsert = dbState.capturedInserts.find(
      (i) => (i.data as { periodType?: string }).periodType === "weekly"
    );
    expect(rollupInsert).toBeDefined();
    expect((rollupInsert!.data as Record<string, unknown>).status).toBe("draft");
    expect((rollupInsert!.data as Record<string, unknown>).periodStart).toBe("2026-04-19");
    expect((rollupInsert!.data as Record<string, unknown>).periodEnd).toBe("2026-04-25");
  });
});

describe("processQueue — rollup_week: fewer than 3 archives", () => {
  beforeEach(resetState);

  it("still generates and inserts when only 1 published archive exists (gap noted in prompt)", async () => {
    dbState.selectResponses = [
      [makeWeekQueueItem()],
      [],
      [makePublishedArchive("2026-04-23")],  // only 1 archive — below the 3-archive threshold
    ];
    mockCallAgent.mockResolvedValueOnce(ARCHIVIST_RESPONSE);

    await processQueue(1);

    // Should still insert — fewer than 3 is a gap, not a skip
    const rollupInsert = dbState.capturedInserts.find(
      (i) => (i.data as { periodType?: string }).periodType === "weekly"
    );
    expect(rollupInsert).toBeDefined();

    // Verify Archivist was called (i.e., no early exit)
    expect(mockCallAgent).toHaveBeenCalledOnce();

    // Queue item should be completed
    const completed = dbState.capturedUpdates.find((u) => u.data.status === "completed");
    expect(completed).toBeDefined();
  });
});

describe("processQueue — rollup_week: empty period", () => {
  beforeEach(resetState);

  it("skips silently and marks queue completed when no archives exist", async () => {
    dbState.selectResponses = [
      [makeWeekQueueItem()],
      [],
      [],  // no published archives
    ];

    await processQueue(1);

    // Archivist should NOT be called
    expect(mockCallAgent).not.toHaveBeenCalled();

    // No rollup should be inserted
    const rollupInsert = dbState.capturedInserts.find(
      (i) => (i.data as { periodType?: string }).periodType === "weekly"
    );
    expect(rollupInsert).toBeUndefined();

    // Queue item should still be completed (no error thrown)
    const completed = dbState.capturedUpdates.find((u) => u.data.status === "completed");
    expect(completed).toBeDefined();
  });
});

describe("processQueue — rollup_week: auto-queues QC review", () => {
  beforeEach(resetState);

  it("inserts a quality_review_archive queue row with rollupId after generating the rollup", async () => {
    dbState.selectResponses = [
      [makeWeekQueueItem()],
      [],
      [makePublishedArchive("2026-04-21"), makePublishedArchive("2026-04-22"), makePublishedArchive("2026-04-23")],
    ];
    mockCallAgent.mockResolvedValueOnce(ARCHIVIST_RESPONSE);

    await processQueue(1);

    const qcInsert = dbState.capturedInserts.find(
      (i) => (i.data as { actionType?: string }).actionType === "quality_review_archive"
    );
    expect(qcInsert).toBeDefined();
    const ctx = (qcInsert!.data as { promptContext: Record<string, unknown> }).promptContext;
    expect(ctx.rollupId).toBe("new-rollup-id");
    expect(ctx.rollupType).toBe("weekly");
  });
});
