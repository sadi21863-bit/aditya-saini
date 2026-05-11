import { vi, describe, it, expect } from "vitest";

// research.ts imports @/db — mock it so prompts.test.ts doesn't need DATABASE_URL
vi.mock("@/lib/agents/research", () => ({
  formatResearchBlock: () => "",
}));

import { buildPrompt } from "@/lib/agents/prompts";
import type { AIQueue } from "@/db/schema";

function makeItem(overrides: Partial<AIQueue>): AIQueue {
  return {
    id:              "test-id",
    agentId:         "ai_theme_setter",
    actionType:      "theme_select",
    roomId:          null,
    targetIdeaId:    null,
    targetCommentId: null,
    promptContext:   null,
    scheduledFor:    new Date(),
    priority:        1,
    status:          "pending",
    executedAt:      null,
    errorMessage:    null,
    resultIdeaId:    null,
    resultCommentId: null,
    createdAt:       new Date(),
    ...overrides,
  } as AIQueue;
}

describe("buildPrompt — theme_select", () => {
  it("returns a non-empty string", () => {
    const item = makeItem({ actionType: "theme_select", promptContext: { recentThemes: ["AI safety", "Quantum compute"] } });
    expect(buildPrompt(item).trim().length).toBeGreaterThan(0);
  });

  it("includes the instruction to avoid repeating recent themes", () => {
    const item = makeItem({ actionType: "theme_select", promptContext: { recentThemes: ["Blockchain identity"] } });
    const prompt = buildPrompt(item);
    expect(prompt).toContain("Blockchain identity");
    expect(prompt).toContain("avoid repeating");
  });

  it("handles empty recentThemes gracefully", () => {
    const item = makeItem({ actionType: "theme_select", promptContext: { recentThemes: [] } });
    const prompt = buildPrompt(item);
    expect(prompt).toContain("none yet");
  });

  it("includes the JSON output instruction", () => {
    const item = makeItem({ actionType: "theme_select" });
    expect(buildPrompt(item)).toContain("JSON");
  });
});

describe("buildPrompt — post_idea", () => {
  it("returns a non-empty string", () => {
    const item = makeItem({
      agentId:      "ai_llama",
      actionType:   "post_idea",
      promptContext: { theme: "Federated learning", rationale: "Privacy trend", suggestedAngles: ["medical", "finance"] },
    });
    expect(buildPrompt(item).trim().length).toBeGreaterThan(0);
  });

  it("includes the theme in the prompt", () => {
    const item = makeItem({
      actionType:   "post_idea",
      promptContext: { theme: "Decentralized AI governance" },
    });
    expect(buildPrompt(item)).toContain("Decentralized AI governance");
  });

  it("asks for JSON with title/pitch/content fields", () => {
    const item = makeItem({ actionType: "post_idea", promptContext: { theme: "X" } });
    const prompt = buildPrompt(item);
    expect(prompt).toContain('"title"');
    expect(prompt).toContain('"pitch"');
    expect(prompt).toContain('"content"');
  });

  it("includes rationale when provided", () => {
    const item = makeItem({
      actionType:   "post_idea",
      promptContext: { theme: "X", rationale: "Very relevant right now" },
    });
    expect(buildPrompt(item)).toContain("Very relevant right now");
  });

  it("falls back to 'Open exploration' when no theme provided", () => {
    const item = makeItem({ actionType: "post_idea", promptContext: {} });
    expect(buildPrompt(item)).toContain("Open exploration");
  });
});

describe("buildPrompt — comment", () => {
  it("returns a non-empty string", () => {
    const item = makeItem({
      agentId:      "ai_gpt_oss",
      actionType:   "comment",
      promptContext: {
        authorHandle: "llama",
        ideaTitle:   "Test title",
        ideaContent: "Test content here",
      },
    });
    expect(buildPrompt(item).trim().length).toBeGreaterThan(0);
  });

  it("includes the author handle", () => {
    const item = makeItem({
      actionType:   "comment",
      promptContext: { authorHandle: "qwen", ideaContent: "Some content" },
    });
    expect(buildPrompt(item)).toContain("@qwen");
  });

  it("includes anti-sycophancy instruction", () => {
    const item = makeItem({
      actionType:   "comment",
      promptContext: { authorHandle: "llama", ideaContent: "content" },
    });
    expect(buildPrompt(item)).toContain("sycophantic");
  });

  it("uses mention prefix when isFromMention is true", () => {
    const item = makeItem({
      actionType:   "comment",
      promptContext: { authorHandle: "llama", ideaContent: "x", isFromMention: true },
    });
    expect(buildPrompt(item)).toContain("tagged you for input");
  });
});

describe("buildPrompt — quality_review", () => {
  it("returns a non-empty string", () => {
    const item = makeItem({
      agentId:      "ai_quality_checker",
      actionType:   "quality_review",
      promptContext: {
        targetType:  "idea",
        content:     "This is the idea content to review.",
        theme:       "Open source AI",
        authorHandle: "llama",
      },
    });
    expect(buildPrompt(item).trim().length).toBeGreaterThan(0);
  });

  it("includes the content to review", () => {
    const item = makeItem({
      actionType:   "quality_review",
      promptContext: { targetType: "idea", content: "My unique review content", authorHandle: "llama" },
    });
    expect(buildPrompt(item)).toContain("My unique review content");
  });

  it("asks for JSON output", () => {
    const item = makeItem({
      actionType:   "quality_review",
      promptContext: { targetType: "idea", content: "x", authorHandle: "a" },
    });
    expect(buildPrompt(item)).toContain("JSON");
  });
});

describe("buildPrompt — archive_day (self-contained in executor)", () => {
  it("throws because archive_day is self-contained and must not reach buildPrompt", () => {
    const item = makeItem({ actionType: "archive_day" });
    expect(() => buildPrompt(item)).toThrow("archive_day is self-contained");
  });

  it("throws for quality_review_archive for the same reason", () => {
    const item = makeItem({ actionType: "quality_review_archive" });
    expect(() => buildPrompt(item)).toThrow("quality_review_archive is self-contained");
  });

  it("error message mentions 'should not reach buildPrompt'", () => {
    const item = makeItem({ actionType: "archive_day" });
    expect(() => buildPrompt(item)).toThrow("should not reach buildPrompt");
  });
});

describe("buildPrompt — unknown action type", () => {
  it("throws for an unrecognised action type", () => {
    const item = makeItem({ actionType: "nonexistent_action" });
    expect(() => buildPrompt(item)).toThrow("No prompt template for action type");
  });
});
