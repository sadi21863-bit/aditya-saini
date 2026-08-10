import { vi, describe, it, expect, beforeEach } from "vitest";
import { buildAILabDebateJudgePrompt, buildAILabDebateTurnPrompt } from "@/lib/agents/prompts";

// ─── Prompt builders ────────────────────────────────────────────────────

describe("buildAILabDebateJudgePrompt", () => {
  it("includes the idea title, content, and theme", () => {
    const prompt = buildAILabDebateJudgePrompt("Federated ML proposal", "We should federate the training pipeline.", "AI and privacy");
    expect(prompt).toContain("Federated ML proposal");
    expect(prompt).toContain("We should federate the training pipeline.");
    expect(prompt).toContain("AI and privacy");
  });

  it("never mentions needs_clarification — there is no human to ask", () => {
    const prompt = buildAILabDebateJudgePrompt("Idea", "Content", "Theme");
    expect(prompt).not.toContain("needs_clarification");
  });

  it("instructs pairing one builder-type with one skeptic-type", () => {
    const prompt = buildAILabDebateJudgePrompt("Idea", "Content", "Theme");
    expect(prompt).toContain("ai_llama");
    expect(prompt).toContain("ai_maverick");
    expect(prompt).toContain("builder-type with one skeptic-type");
  });

  it("requests the exact JSON shape with recommended_agents and recommended_mode", () => {
    const prompt = buildAILabDebateJudgePrompt("Idea", "Content", "Theme");
    expect(prompt).toContain("recommended_agents");
    expect(prompt).toContain("recommended_mode");
  });
});

describe("buildAILabDebateTurnPrompt", () => {
  const baseArgs = {
    ideaTitle:   "Federated ML proposal",
    ideaContent: "We should federate the training pipeline.",
    theme:       "AI and privacy",
    mode:        "risk_scan",
    reasoning:   "This is a testable prediction.",
    agent:       { name: "Llama", persona: "You are Llama." },
  };

  it("Turn A (no prior turn) does not include the contest-a-specific-claim constraint", () => {
    const prompt = buildAILabDebateTurnPrompt({ ...baseArgs, agentATurn: null, agentAName: null });
    expect(prompt).not.toContain("MUST follow this structure");
    expect(prompt).toContain("Debate of the Day");
  });

  it("Turn B (with prior turn) must name and contest Agent A's specific claim", () => {
    const prompt = buildAILabDebateTurnPrompt({
      ...baseArgs,
      agentATurn: { content: "Federation will fail because of data heterogeneity." },
      agentAName: "Llama",
    });
    expect(prompt).toContain("Federation will fail because of data heterogeneity.");
    expect(prompt).toContain("MUST follow this structure");
    expect(prompt).toContain("name the SPECIFIC claim");
  });

  it("includes the mode-specific critique/build framing", () => {
    const riskScan = buildAILabDebateTurnPrompt({ ...baseArgs, mode: "risk_scan", agentATurn: null, agentAName: null });
    expect(riskScan).toContain("Find failure modes");

    const brainstorm = buildAILabDebateTurnPrompt({ ...baseArgs, mode: "brainstorm", agentATurn: null, agentAName: null });
    expect(brainstorm).toContain("Build on this idea");
  });
});

// ─── Scheduler: queueAILabDebateOfDay ───────────────────────────────────

const capturedInserts: Array<Record<string, unknown>> = [];

function thenableChain(result: unknown) {
  const chain: Record<string, unknown> = {};
  chain.from    = () => chain;
  chain.where   = () => chain;
  chain.orderBy = () => chain;
  chain.limit   = () => Promise.resolve(result);
  // Makes `await db.select(...).from(...).where(...)` resolve without .limit()
  chain.then    = (resolve: (v: unknown) => void) => Promise.resolve(result).then(resolve);
  return chain;
}

const mockDbSelect = vi.hoisted(() => vi.fn());
const mockDbInsert = vi.hoisted(() =>
  vi.fn().mockReturnValue({
    values: vi.fn().mockImplementation((data: Record<string, unknown>) => {
      capturedInserts.push(data);
      return Promise.resolve(undefined);
    }),
  })
);

vi.mock("@/db", () => ({
  db: { select: mockDbSelect, insert: mockDbInsert },
}));

import { queueAILabDebateOfDay } from "@/lib/agents/scheduler";

const IDEA_A = { id: "idea-a", title: "Idea A", content: "Content A", context: null };
const IDEA_B = { id: "idea-b", title: "Idea B", content: "Content B", context: null };

describe("queueAILabDebateOfDay", () => {
  beforeEach(() => {
    capturedInserts.length = 0;
    vi.clearAllMocks();
  });

  it("does nothing when no ideas were posted today", async () => {
    mockDbSelect
      .mockReturnValueOnce(thenableChain([]))  // theme lookup
      .mockReturnValueOnce(thenableChain([]));  // todaysIdeas
    await queueAILabDebateOfDay("2026-07-17");
    expect(capturedInserts).toHaveLength(0);
  });

  it("skips an idea with fewer than 2 distinct participant commenters", async () => {
    mockDbSelect
      .mockReturnValueOnce(thenableChain([{ theme: "Theme" }]))
      .mockReturnValueOnce(thenableChain([IDEA_A]))
      .mockReturnValueOnce(thenableChain([
        { ideaId: "idea-a", userId: "ai_llama" },
        { ideaId: "idea-a", userId: "ai_llama" },
      ]));
    await queueAILabDebateOfDay("2026-07-17");
    expect(capturedInserts).toHaveLength(0);
  });

  it("picks the qualifying idea with the most comments, and skips one below the 2-participant bar", async () => {
    mockDbSelect
      .mockReturnValueOnce(thenableChain([{ theme: "Theme" }]))
      .mockReturnValueOnce(thenableChain([IDEA_A, IDEA_B]))
      .mockReturnValueOnce(thenableChain([
        { ideaId: "idea-a", userId: "ai_llama" },
        { ideaId: "idea-a", userId: "ai_llama" },
        { ideaId: "idea-b", userId: "ai_llama" },
        { ideaId: "idea-b", userId: "ai_scout" },
        { ideaId: "idea-b", userId: "ai_maverick" },
      ]))
      .mockReturnValueOnce(thenableChain([]));  // idempotency check — nothing existing
    await queueAILabDebateOfDay("2026-07-17");
    expect(capturedInserts).toHaveLength(1);
    expect(capturedInserts[0].targetIdeaId).toBe("idea-b");
    expect(capturedInserts[0].actionType).toBe("ai_lab_debate");
  });

  it("is idempotent — skips if an ai_lab_debate action already exists for the picked idea", async () => {
    mockDbSelect
      .mockReturnValueOnce(thenableChain([{ theme: "Theme" }]))
      .mockReturnValueOnce(thenableChain([IDEA_A]))
      .mockReturnValueOnce(thenableChain([
        { ideaId: "idea-a", userId: "ai_llama" },
        { ideaId: "idea-a", userId: "ai_scout" },
      ]))
      .mockReturnValueOnce(thenableChain([{ id: "existing-queue-row" }]));  // already exists
    await queueAILabDebateOfDay("2026-07-17");
    expect(capturedInserts).toHaveLength(0);
  });
});
