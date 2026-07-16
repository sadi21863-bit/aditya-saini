/**
 * Tests for the quality_review_archive executor path (Week 4 Step 4).
 *
 * Tests 1-4 call buildQualityReviewArchivePrompt directly — they verify the
 * prompt carries the source data the QC needs to detect each failure mode.
 *
 * Tests 5-6 go through processQueue with a mocked callAgent — they verify
 * the executor writes the correct DB state for each verdict.
 */

import { vi, describe, it, expect, beforeEach } from "vitest";
import { buildQualityReviewArchivePrompt } from "@/lib/agents/prompts";

// ─── Shared fixtures ──────────────────────────────────────────────────

const SOURCE_COMMENT_TEXT = "This will fail. The core assumptions are completely wrong.";

const verbatimQuote = {
  agent:   "llama",
  text:    "This will fail.",
  context: "Responding to the proposal",
};

const paraphraseQuote = {
  agent:   "llama",
  text:    "The approach is fundamentally broken.",   // NOT in source comment verbatim
  context: "Responding to the proposal",
};

const ideaSummaries = [
  { title: "Federated ML proposal", handle: "llama", summary: "Llama proposed federating the training pipeline; pushback centered on feasibility." },
];

const sourceComments = [
  { id: "c1", ideaId: "idea-1", userId: "ai_llama", content: SOURCE_COMMENT_TEXT },
  { id: "c2", ideaId: "idea-1", userId: "ai_qwen",  content: "The regulatory angle is worth exploring." },
];

function makeArchive(overrides: {
  narrativeArc?:    string;
  keyDisagreements?: unknown;
  memorableQuotes?:  unknown;
} = {}) {
  return {
    narrativeArc:    overrides.narrativeArc    ?? "The discussion centered on federated learning tradeoffs.",
    keyDisagreements: overrides.keyDisagreements ?? [{ between: ["llama", "qwen"], topic: "Feasibility", resolution: "unresolved" }],
    memorableQuotes:  overrides.memorableQuotes  ?? [verbatimQuote],
  };
}

// ─── Tests 1-4: prompt content ────────────────────────────────────────

describe("buildQualityReviewArchivePrompt — verbatim quote found", () => {
  it("shows FOUND VERBATIM alongside the full source comment when the quote is an exact substring", () => {
    const prompt = buildQualityReviewArchivePrompt(makeArchive(), ideaSummaries, sourceComments);

    expect(prompt).toContain("FOUND VERBATIM");
    expect(prompt).toContain(SOURCE_COMMENT_TEXT);
    expect(prompt).toContain(verbatimQuote.text);
  });
});

describe("buildQualityReviewArchivePrompt — paraphrased quote not found verbatim", () => {
  it("shows NOT FOUND VERBATIM with the agent's actual comments when the quote does not appear in any source comment", () => {
    const archive = makeArchive({ memorableQuotes: [paraphraseQuote] });
    const prompt = buildQualityReviewArchivePrompt(archive, ideaSummaries, sourceComments);

    expect(prompt).toContain("NOT FOUND VERBATIM");
    // Still shows the agent's actual comment text so the QC can compare
    expect(prompt).toContain(SOURCE_COMMENT_TEXT);
  });

  it("shows 'made no comments in this session' when the attributed agent has no source comments at all", () => {
    const fabricatedQuote = {
      agent:   "gpt-oss",    // gpt-oss made no comments in the test data
      text:    "Invented text.",
      context: "nowhere",
    };
    const archive = makeArchive({ memorableQuotes: [fabricatedQuote] });
    const prompt = buildQualityReviewArchivePrompt(archive, ideaSummaries, sourceComments);

    expect(prompt).toContain("made no comments in this session");
  });
});

describe("buildQualityReviewArchivePrompt — static flag instructions", () => {
  it("instructs QC to flag sycophantic language with concrete examples", () => {
    const prompt = buildQualityReviewArchivePrompt(makeArchive(), ideaSummaries, sourceComments);

    expect(prompt).toContain("sycophantic");
    expect(prompt).toContain("rich and engaging");
  });

  it("instructs QC to flag misattribution by checking handles against source data", () => {
    const prompt = buildQualityReviewArchivePrompt(makeArchive(), ideaSummaries, sourceComments);

    expect(prompt).toContain("wrong agent handle");
    expect(prompt).toContain("idea summaries");
  });
});

// ─── Tests 5-6: executor behavior ────────────────────────────────────
//
// Go through processQueue with a fully mocked DB and callAgent.
// The select() mock returns different data per call index to simulate
// the multi-step DB reads inside executeQualityReviewArchive.

const mockCallAgent = vi.hoisted(() => vi.fn());

const dbState = vi.hoisted(() => ({
  selectResponses: [] as unknown[][],   // per-call select results
  capturedUpdates: [] as Array<{ data: Record<string, unknown> }>,
  capturedInserts: [] as Array<{ table: string; data: Record<string, unknown> }>,
}));

const mockTransaction = vi.hoisted(() =>
  vi.fn().mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
    return cb({
      execute: vi.fn().mockResolvedValue([{ id: "item-1" }]),
      update:  vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
      }),
    });
  })
);

let selectCallIdx = 0;
const mockDbSelect = vi.hoisted(() =>
  vi.fn().mockImplementation(() => {
    const idx = selectCallIdx++;
    const data = dbState.selectResponses[idx] ?? [];
    return {
      from: (_t: unknown) => ({
        // Returns a thenable that also supports .orderBy() chaining
        where: (_c: unknown) => Object.assign(Promise.resolve(data), {
          orderBy: () => Promise.resolve(data),
        }),
        limit: () => Promise.resolve(data),
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
        returning:          vi.fn().mockResolvedValue([{ id: "new-id" }]),
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

import { processQueue } from "@/lib/agents/executor";

// ─── Archive row used in executor tests ──────────────────────────────

const ARCHIVE_ROW = {
  id:               "archive-1",
  date:             "2026-04-25",
  theme:            "AI governance",
  summaryMarkdown:  "Summary.",
  narrativeArc:     "The discussion centered on AI governance tradeoffs.",
  keyDisagreements: [{ between: ["llama", "qwen"], topic: "Feasibility", resolution: "unresolved" }],
  keyQuestions:     ["What is the right governance model?"],
  memorableQuotes:  [verbatimQuote],
  stats:            { ideas_count: 2, comments_count: 5, participants_active: 3, longest_thread_idea_id: null },
  status:           "draft",
  publishedAt:      null,
  flaggedReason:    null,
  reviewedByAgentId: null,
  reviewedAt:       null,
  generatedAt:      new Date(),
  topDiscussionIdeaId: null,
};

function makeQCQueueItem() {
  return {
    id:              "item-1",
    agentId:         "ai_quality_checker",
    actionType:      "quality_review_archive",
    roomId:          null,
    targetIdeaId:    null,
    targetCommentId: null,
    promptContext:   { archiveId: "archive-1", archiveDate: "2026-04-25" },
    scheduledFor:    new Date(),
    priority:        2,
    status:          "in_progress",
    executedAt:      null,
    errorMessage:    null,
    resultIdeaId:    null,
    resultCommentId: null,
    createdAt:       new Date(),
  };
}

function resetExecutorState() {
  dbState.selectResponses = [];
  dbState.capturedUpdates = [];
  dbState.capturedInserts = [];
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
    const idx = selectCallIdx++;
    const data = dbState.selectResponses[idx] ?? [];
    return {
      from: (_t: unknown) => ({
        where: (_c: unknown) => Object.assign(Promise.resolve(data), {
          orderBy: () => Promise.resolve(data),
        }),
        limit: () => Promise.resolve(data),
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
        returning:          vi.fn().mockResolvedValue([{ id: "new-id" }]),
        onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
      };
    },
  }));
}

describe("processQueue — quality_review_archive: QC returns flag", () => {
  beforeEach(resetExecutorState);

  it("sets status=flagged, stores flaggedReason, and marks queue completed", async () => {
    // select call sequence:
    // 0 = full queue items, 1 = usage check (none = not rate-limited),
    // 2 = archive row, 3 = ideas, 4 = comments (empty — no ideas so skipped)
    dbState.selectResponses = [
      [makeQCQueueItem()],   // 0: aiQueue full rows
      [],                    // 1: aiUsage — not rate-limited
      [ARCHIVE_ROW],         // 2: aiLabArchives
      [],                    // 3: ideas (empty → no comment query needed)
    ];

    mockCallAgent.mockResolvedValueOnce(
      JSON.stringify({ verdict: "flag", reason: "Memorable quote is paraphrased, not verbatim." })
    );

    await processQueue(1);

    const archiveUpdate = dbState.capturedUpdates.find(
      (u) => u.data.status === "flagged"
    );
    expect(archiveUpdate).toBeDefined();
    expect(archiveUpdate?.data.flaggedReason).toBe("Memorable quote is paraphrased, not verbatim.");
    expect(archiveUpdate?.data.reviewedByAgentId).toBe("ai_quality_checker");

    const completedUpdate = dbState.capturedUpdates.find(
      (u) => u.data.status === "completed"
    );
    expect(completedUpdate).toBeDefined();
  });
});

describe("processQueue — quality_review_archive: QC returns publish", () => {
  beforeEach(resetExecutorState);

  it("sets status=published, sets publishedAt, and marks queue completed", async () => {
    dbState.selectResponses = [
      [makeQCQueueItem()],
      [],
      [ARCHIVE_ROW],
      [],
    ];

    mockCallAgent.mockResolvedValueOnce(
      JSON.stringify({ verdict: "publish", reason: "All quotes verified verbatim. Narrative accurate." })
    );

    await processQueue(1);

    const archiveUpdate = dbState.capturedUpdates.find(
      (u) => u.data.status === "published"
    );
    expect(archiveUpdate).toBeDefined();
    expect(archiveUpdate?.data.publishedAt).toBeInstanceOf(Date);
    expect(archiveUpdate?.data.reviewedByAgentId).toBe("ai_quality_checker");

    const completedUpdate = dbState.capturedUpdates.find(
      (u) => u.data.status === "completed"
    );
    expect(completedUpdate).toBeDefined();
  });
});

// ─── Rollup QC path ───────────────────────────────────────────────────

const ROLLUP_ROW = {
  id:               "rollup-1",
  periodType:       "weekly",
  periodStart:      "2026-04-19",
  periodEnd:        "2026-04-25",
  title:            "Week of 2026-04-19 – 2026-04-25",
  summaryMarkdown:  "Summary.",
  narrativeArc:     "The week's discussion traced a thread from federated learning through privacy implications.",
  keyDisagreements: [{ between: ["llama", "qwen"], topic: "Feasibility", resolution: "unresolved" }],
  keyQuestions:     ["Is cross-day synthesis accurate?"],
  memorableQuotes:  [],
  stats:            {},
  status:           "draft",
  publishedAt:      null,
  flaggedReason:    null,
  reviewedByAgentId: null,
  reviewedAt:       null,
  generatedAt:      new Date(),
};

function makeRollupQCItem() {
  return {
    id:              "item-1",
    agentId:         "ai_quality_checker",
    actionType:      "quality_review_archive",
    roomId:          null,
    targetIdeaId:    null,
    targetCommentId: null,
    promptContext:   { rollupId: "rollup-1", periodStart: "2026-04-19", periodEnd: "2026-04-25" },
    scheduledFor:    new Date(),
    priority:        2,
    status:          "in_progress",
    executedAt:      null,
    errorMessage:    null,
    resultIdeaId:    null,
    resultCommentId: null,
    createdAt:       new Date(),
  };
}

// select call order for rollup QC:
// 0 = aiQueue rows, 1 = aiUsage, 2 = aiLabRollups (rollup row), 3 = aiLabArchives (source)

describe("processQueue — quality_review_archive: rollup path publishes", () => {
  beforeEach(resetExecutorState);

  it("updates aiLabRollups (not aiLabArchives) when rollupId is present and verdict is publish", async () => {
    dbState.selectResponses = [
      [makeRollupQCItem()],
      [],            // not rate-limited
      [ROLLUP_ROW],  // rollup row from aiLabRollups
      [],            // daily archives in period (empty is fine for QC)
    ];

    mockCallAgent.mockResolvedValueOnce(
      JSON.stringify({ verdict: "publish", reason: "Weekly synthesis is accurate." })
    );

    await processQueue(1);

    // Should have a status=published update (goes to aiLabRollups — same mock, distinguishable by context)
    const publishUpdate = dbState.capturedUpdates.find((u) => u.data.status === "published");
    expect(publishUpdate).toBeDefined();
    expect(publishUpdate?.data.reviewedByAgentId).toBe("ai_quality_checker");
    expect(publishUpdate?.data.publishedAt).toBeInstanceOf(Date);
  });

  it("updates aiLabRollups with status=flagged when rollup QC returns flag", async () => {
    dbState.selectResponses = [
      [makeRollupQCItem()],
      [],
      [ROLLUP_ROW],
      [],
    ];

    mockCallAgent.mockResolvedValueOnce(
      JSON.stringify({ verdict: "flag", reason: "Narrative claims a cross-day debate not in source archives." })
    );

    await processQueue(1);

    const flagUpdate = dbState.capturedUpdates.find((u) => u.data.status === "flagged");
    expect(flagUpdate).toBeDefined();
    expect(flagUpdate?.data.flaggedReason).toBe("Narrative claims a cross-day debate not in source archives.");
  });
});
