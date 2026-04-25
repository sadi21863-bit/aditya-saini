import { vi, describe, it, expect, beforeEach } from "vitest";

// ─── DB mock ──────────────────────────────────────────────────────────
const capturedInserts: Array<Record<string, unknown>> = [];

const mockInsertValues = vi.hoisted(() =>
  vi.fn().mockImplementation((data: Record<string, unknown>) => {
    capturedInserts.push(data);
    return Promise.resolve(undefined);
  })
);

const mockDbInsert = vi.hoisted(() =>
  vi.fn().mockReturnValue({ values: mockInsertValues })
);

// Generic chainable select mock — created AFTER vi.hoisted so makeSelectChain
// is available at the point makeSelectChain is called (in beforeEach, not at hoist time).
function makeSelectChain(result: unknown = []) {
  return {
    from: () => ({
      where:   () => ({ limit: () => Promise.resolve(result) }),
      orderBy: () => ({ limit: () => Promise.resolve(result) }),
      limit:   () => Promise.resolve(result),
    }),
  };
}

// Initialized without a default — each test's beforeEach sets mockReturnValue
const mockDbSelect = vi.hoisted(() => vi.fn());

vi.mock("@/db", () => ({
  db: {
    select: mockDbSelect,
    insert: mockDbInsert,
  },
}));

import {
  queueThemeSelection,
  queueDailyIdeas,
  queueCommentsOnIdea,
  queueMentionResponse,
  queueQualityReview,
  queueDailyArchive,
} from "@/lib/agents/scheduler";

// ─── Helpers ──────────────────────────────────────────────────────────

function resetCaptures() {
  capturedInserts.length = 0;
}

function lastInsert() {
  return capturedInserts[capturedInserts.length - 1];
}

// ─── Theme selection ──────────────────────────────────────────────────

describe("queueThemeSelection", () => {
  beforeEach(() => {
    resetCaptures();
    mockDbSelect.mockReturnValue(makeSelectChain([])); // no recent themes
    mockInsertValues.mockImplementation((data) => {
      capturedInserts.push(data);
      return Promise.resolve(undefined);
    });
  });

  it("writes one ai_queue row", async () => {
    await queueThemeSelection();
    expect(capturedInserts).toHaveLength(1);
  });

  it("sets agentId to ai_theme_setter", async () => {
    await queueThemeSelection();
    expect(lastInsert().agentId).toBe("ai_theme_setter");
  });

  it("sets actionType to theme_select", async () => {
    await queueThemeSelection();
    expect(lastInsert().actionType).toBe("theme_select");
  });

  it("sets priority to 1 (critical)", async () => {
    await queueThemeSelection();
    expect(lastInsert().priority).toBe(1);
  });

  it("sets status to pending", async () => {
    await queueThemeSelection();
    expect(lastInsert().status).toBe("pending");
  });

  it("schedules for now (not deferred)", async () => {
    const before = Date.now();
    await queueThemeSelection();
    const after  = Date.now();
    const ts = (lastInsert().scheduledFor as Date).getTime();
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after + 100);
  });

  it("includes recentThemes from DB in promptContext", async () => {
    mockDbSelect.mockReturnValue(
      makeSelectChain([{ theme: "AI safety" }, { theme: "Quantum" }])
    );
    resetCaptures();
    await queueThemeSelection();
    const ctx = lastInsert().promptContext as Record<string, unknown>;
    expect(ctx.recentThemes).toEqual(["AI safety", "Quantum"]);
  });
});

// ─── Daily ideas ──────────────────────────────────────────────────────

describe("queueDailyIdeas", () => {
  beforeEach(() => {
    resetCaptures();
    // Return a theme for context
    mockDbSelect.mockReturnValue(
      makeSelectChain([{
        date: "2026-04-25",
        theme: "Federated learning",
        rationale: "Privacy matters",
        researchNotes: { suggested_angles: ["medical", "finance"] },
      }])
    );
    mockInsertValues.mockImplementation((data) => {
      capturedInserts.push(data);
      return Promise.resolve(undefined);
    });
  });

  it("queues exactly 3 rows (one per participant)", async () => {
    await queueDailyIdeas();
    expect(capturedInserts).toHaveLength(3);
  });

  it("all rows have actionType post_idea", async () => {
    await queueDailyIdeas();
    for (const row of capturedInserts) {
      expect(row.actionType).toBe("post_idea");
    }
  });

  it("all rows have priority 7", async () => {
    await queueDailyIdeas();
    for (const row of capturedInserts) {
      expect(row.priority).toBe(7);
    }
  });

  it("rows target the 3 different participant agents", async () => {
    await queueDailyIdeas();
    const agentIds = capturedInserts.map((r) => r.agentId as string);
    expect(new Set(agentIds).size).toBe(3);
    expect(agentIds).toEqual(expect.arrayContaining(["ai_llama", "ai_gpt_oss", "ai_qwen"]));
  });

  it("rows are spread across 0–120 min (scheduledFor increases)", async () => {
    await queueDailyIdeas();
    const timestamps = capturedInserts.map((r) => (r.scheduledFor as Date).getTime());
    // Each subsequent idea should be scheduled later (allow small jitter delta)
    expect(timestamps[1]).toBeGreaterThan(timestamps[0]);
    expect(timestamps[2]).toBeGreaterThan(timestamps[1]);
  });

  it("promptContext carries the day's theme", async () => {
    await queueDailyIdeas();
    for (const row of capturedInserts) {
      const ctx = row.promptContext as Record<string, unknown>;
      expect(ctx.theme).toBe("Federated learning");
    }
  });
});

// ─── Comments on idea ─────────────────────────────────────────────────

describe("queueCommentsOnIdea", () => {
  const IDEA_ID  = "idea-uuid-123";
  const AUTHOR   = "ai_llama";

  beforeEach(() => {
    resetCaptures();
    mockDbSelect.mockReturnValue(
      makeSelectChain([{
        id:      IDEA_ID,
        title:   "Great idea title",
        context: "The pitch",
        content: "The full content",
        userId:  AUTHOR,
      }])
    );
    mockInsertValues.mockImplementation((data) => {
      capturedInserts.push(data);
      return Promise.resolve(undefined);
    });
  });

  it("queues exactly 2 rows", async () => {
    await queueCommentsOnIdea(IDEA_ID, AUTHOR);
    expect(capturedInserts).toHaveLength(2);
  });

  it("neither commenter is the original author", async () => {
    await queueCommentsOnIdea(IDEA_ID, AUTHOR);
    for (const row of capturedInserts) {
      expect(row.agentId).not.toBe(AUTHOR);
    }
  });

  it("sets actionType to comment", async () => {
    await queueCommentsOnIdea(IDEA_ID, AUTHOR);
    for (const row of capturedInserts) {
      expect(row.actionType).toBe("comment");
    }
  });

  it("sets priority to 6", async () => {
    await queueCommentsOnIdea(IDEA_ID, AUTHOR);
    for (const row of capturedInserts) {
      expect(row.priority).toBe(6);
    }
  });

  it("sets targetIdeaId to the idea's UUID", async () => {
    await queueCommentsOnIdea(IDEA_ID, AUTHOR);
    for (const row of capturedInserts) {
      expect(row.targetIdeaId).toBe(IDEA_ID);
    }
  });

  it("schedules in the 15–45 min window", async () => {
    await queueCommentsOnIdea(IDEA_ID, AUTHOR);
    const now = Date.now();
    for (const row of capturedInserts) {
      const delayMin = ((row.scheduledFor as Date).getTime() - now) / 60_000;
      expect(delayMin).toBeGreaterThanOrEqual(14.9);
      expect(delayMin).toBeLessThanOrEqual(45.1);
    }
  });
});

// ─── Mention response ─────────────────────────────────────────────────

describe("queueMentionResponse", () => {
  beforeEach(() => {
    resetCaptures();
    mockInsertValues.mockImplementation((data) => {
      capturedInserts.push(data);
      return Promise.resolve(undefined);
    });
  });

  it("queues one row", async () => {
    await queueMentionResponse({
      agentId:          "ai_llama",
      ideaId:           "idea-uuid",
      mentioningUserId: "user-1",
      isRandomSelection: false,
      authorHandle:     "some-user",
      ideaTitle:        "Title",
      ideaContent:      "Content",
    });
    expect(capturedInserts).toHaveLength(1);
  });

  it("sets actionType to comment (mention responses are comments)", async () => {
    await queueMentionResponse({
      agentId: "ai_llama", ideaId: "id", mentioningUserId: "u",
      isRandomSelection: false, authorHandle: "a", ideaTitle: "t", ideaContent: "c",
    });
    expect(lastInsert().actionType).toBe("comment");
  });

  it("sets priority to 5 (higher than regular Lab comments)", async () => {
    await queueMentionResponse({
      agentId: "ai_qwen", ideaId: "id", mentioningUserId: "u",
      isRandomSelection: true, authorHandle: "a", ideaTitle: "t", ideaContent: "c",
    });
    expect(lastInsert().priority).toBe(5);
  });

  it("sets isFromMention=true in promptContext", async () => {
    await queueMentionResponse({
      agentId: "ai_gpt_oss", ideaId: "id", mentioningUserId: "u",
      isRandomSelection: false, authorHandle: "a", ideaTitle: "t", ideaContent: "c",
    });
    const ctx = lastInsert().promptContext as Record<string, unknown>;
    expect(ctx.isFromMention).toBe(true);
  });

  it("schedules in the 10–30 min window", async () => {
    await queueMentionResponse({
      agentId: "ai_llama", ideaId: "id", mentioningUserId: "u",
      isRandomSelection: false, authorHandle: "a", ideaTitle: "t", ideaContent: "c",
    });
    const now = Date.now();
    const delayMin = ((lastInsert().scheduledFor as Date).getTime() - now) / 60_000;
    expect(delayMin).toBeGreaterThanOrEqual(9.9);
    expect(delayMin).toBeLessThanOrEqual(30.1);
  });
});

// ─── Quality review ───────────────────────────────────────────────────

describe("queueQualityReview", () => {
  beforeEach(() => {
    resetCaptures();
    // idea lookup + theme lookup
    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([{
        id: "post-uuid", title: "Title", context: "Pitch", content: "Content", userId: "ai_llama",
      }]))
      .mockReturnValueOnce(makeSelectChain([{ theme: "Open source AI" }]));
    mockInsertValues.mockImplementation((data) => {
      capturedInserts.push(data);
      return Promise.resolve(undefined);
    });
  });

  it("sets agentId to ai_quality_checker", async () => {
    await queueQualityReview("post-uuid", "idea");
    expect(lastInsert().agentId).toBe("ai_quality_checker");
  });

  it("sets actionType to quality_review", async () => {
    await queueQualityReview("post-uuid", "idea");
    expect(lastInsert().actionType).toBe("quality_review");
  });

  it("sets priority to 2", async () => {
    await queueQualityReview("post-uuid", "idea");
    expect(lastInsert().priority).toBe(2);
  });

  it("schedules within 30 seconds", async () => {
    const before = Date.now();
    await queueQualityReview("post-uuid", "idea");
    const ts = (lastInsert().scheduledFor as Date).getTime();
    expect(ts - before).toBeLessThanOrEqual(31_000);
  });
});

// ─── Daily archive ────────────────────────────────────────────────────

describe("queueDailyArchive", () => {
  beforeEach(() => {
    resetCaptures();
    mockDbSelect.mockReturnValue(makeSelectChain([{ theme: "Daily topic" }]));
    mockInsertValues.mockImplementation((data) => {
      capturedInserts.push(data);
      return Promise.resolve(undefined);
    });
  });

  it("queues one row", async () => {
    await queueDailyArchive();
    expect(capturedInserts).toHaveLength(1);
  });

  it("sets agentId to ai_archivist", async () => {
    await queueDailyArchive();
    expect(lastInsert().agentId).toBe("ai_archivist");
  });

  it("sets actionType to archive_day", async () => {
    await queueDailyArchive();
    expect(lastInsert().actionType).toBe("archive_day");
  });

  it("sets priority to 1", async () => {
    await queueDailyArchive();
    expect(lastInsert().priority).toBe(1);
  });

  it("schedules for now", async () => {
    const before = Date.now();
    await queueDailyArchive();
    const after  = Date.now();
    const ts = (lastInsert().scheduledFor as Date).getTime();
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after + 100);
  });
});
