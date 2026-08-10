/**
 * Tests for the rollup_month executor path (Week 4 Step 5).
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
        where: (_c: unknown) => Object.assign(Promise.resolve(data), {
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
        returning:          vi.fn().mockResolvedValue([{ id: "new-monthly-id" }]),
        onConflictDoUpdate: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: "new-monthly-id" }]),
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
  theme:            "Monthly synthesis",
  narrative_arc:    "April was defined by an ongoing tension between pragmatic engineering concerns and theoretical ambitions.",
  key_disagreements: [],
  key_questions:    ["What is the right scope for AI Lab discussions?"],
  memorable_quotes: [],
  stats:            { ideas_count: 20, comments_count: 60, participants_active: 3, longest_thread_idea_id: null },
});

function makeMonthQueueItem() {
  return {
    id:              "item-1",
    agentId:         "ai_archivist",
    actionType:      "rollup_month",
    roomId:          "lab-room",
    targetIdeaId:    null,
    targetCommentId: null,
    promptContext:   { periodStart: "2026-04-01", periodEnd: "2026-04-30" },
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

function makeWeeklyRollup(periodStart: string) {
  return {
    id:               `rollup-${periodStart}`,
    periodType:       "weekly",
    periodStart,
    periodEnd:        periodStart.replace("01", "07"),
    title:            `Week of ${periodStart}`,
    summaryMarkdown:  "Summary.",
    narrativeArc:     `Weekly narrative for ${periodStart}.`,
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
  };
}

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
        returning:          vi.fn().mockResolvedValue([{ id: "new-monthly-id" }]),
        onConflictDoUpdate: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: "new-monthly-id" }]),
        }),
      };
    },
  }));
}

// select call order for rollup_month:
// 0 = aiQueue full rows, 1 = aiUsage, 2 = quota check,
// 3 = weekly rollups query, 4 = daily archives fallback (only reached when weekly rollups < 2)

describe("processQueue — rollup_month: uses weekly rollups when available", () => {
  beforeEach(resetState);

  it("inserts monthly rollup with periodType='monthly' and status='published' when weekly rollups are sufficient", async () => {
    dbState.selectResponses = [
      [makeMonthQueueItem()],
      [],       // usage check
      [],       // quota check
      [makeWeeklyRollup("2026-04-01"), makeWeeklyRollup("2026-04-08"), makeWeeklyRollup("2026-04-15")],
      // No fallback needed — 3 weekly rollups is not sparse
    ];
    mockCallAgent.mockResolvedValueOnce(ARCHIVIST_RESPONSE);

    await processQueue(1);

    const rollupInsert = dbState.capturedInserts.find(
      (i) => (i.data as { periodType?: string }).periodType === "monthly"
    );
    expect(rollupInsert).toBeDefined();
    expect((rollupInsert!.data as Record<string, unknown>).status).toBe("published");
  });
});

describe("processQueue — rollup_month: falls back to daily archives when weeklies are sparse", () => {
  beforeEach(resetState);

  it("uses daily archives when only 1 weekly rollup exists for the month", async () => {
    dbState.selectResponses = [
      [makeMonthQueueItem()],
      [],       // usage check
      [],       // quota check
      [makeWeeklyRollup("2026-04-01")],  // only 1 weekly — sparse, triggers fallback
      [makePublishedArchive("2026-04-05"), makePublishedArchive("2026-04-06")],
    ];
    mockCallAgent.mockResolvedValueOnce(ARCHIVIST_RESPONSE);

    await processQueue(1);

    // Archivist was called with daily fallback data
    expect(mockCallAgent).toHaveBeenCalledOnce();

    // Monthly rollup is still inserted
    const rollupInsert = dbState.capturedInserts.find(
      (i) => (i.data as { periodType?: string }).periodType === "monthly"
    );
    expect(rollupInsert).toBeDefined();
  });

  it("falls back to daily archives when no weekly rollups exist at all", async () => {
    dbState.selectResponses = [
      [makeMonthQueueItem()],
      [],       // usage check
      [],       // quota check
      [],       // zero weekly rollups — sparse
      [makePublishedArchive("2026-04-10"), makePublishedArchive("2026-04-11"), makePublishedArchive("2026-04-12")],
    ];
    mockCallAgent.mockResolvedValueOnce(ARCHIVIST_RESPONSE);

    await processQueue(1);

    expect(mockCallAgent).toHaveBeenCalledOnce();
    const rollupInsert = dbState.capturedInserts.find(
      (i) => (i.data as { periodType?: string }).periodType === "monthly"
    );
    expect(rollupInsert).toBeDefined();
  });
});

describe("processQueue — rollup_month: empty period", () => {
  beforeEach(resetState);

  it("skips silently with no insert when neither weekly rollups nor daily archives exist", async () => {
    dbState.selectResponses = [
      [makeMonthQueueItem()],
      [],       // usage check
      [],       // quota check
      [],  // no weekly rollups
      [],  // no daily archives either
    ];

    await processQueue(1);

    expect(mockCallAgent).not.toHaveBeenCalled();

    const rollupInsert = dbState.capturedInserts.find(
      (i) => (i.data as { periodType?: string }).periodType === "monthly"
    );
    expect(rollupInsert).toBeUndefined();

    // Still completes the queue item cleanly
    const completed = dbState.capturedUpdates.find((u) => u.data.status === "completed");
    expect(completed).toBeDefined();
  });
});
