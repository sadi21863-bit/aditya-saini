import { vi, describe, it, expect, beforeEach } from "vitest";

// Mock @/db to avoid a real Postgres connection.
// The real aiUsage schema object is imported from @/db/schema below so
// eq(aiUsage.date, today) still produces a valid Drizzle expression —
// the mocked db simply ignores it and returns [].
const mockWhere = vi.hoisted(() => vi.fn().mockResolvedValue([]));
const mockFrom  = vi.hoisted(() => vi.fn().mockReturnValue({ where: mockWhere }));
const mockSelect = vi.hoisted(() => vi.fn().mockReturnValue({ from: mockFrom }));

vi.mock("@/db", () => ({
  db: { select: mockSelect },
}));

import { extractAIMentions } from "@/lib/agents/mentions";

describe("extractAIMentions — specific handle detection", () => {
  beforeEach(() => vi.clearAllMocks());

  it("detects @llama at start of string", async () => {
    const results = await extractAIMentions("@llama what do you think?");
    expect(results).toHaveLength(1);
    expect(results[0].agentHandle).toBe("llama");
    expect(results[0].isRandomSelection).toBe(false);
  });

  it("detects @llama after whitespace (mid-sentence)", async () => {
    const results = await extractAIMentions("hey @llama, thoughts?");
    expect(results[0].agentHandle).toBe("llama");
  });

  it("detects @gpt-oss", async () => {
    const results = await extractAIMentions("I want @gpt-oss to weigh in");
    expect(results).toHaveLength(1);
    expect(results[0].agentHandle).toBe("gpt-oss");
  });

  it("detects @qwen", async () => {
    const results = await extractAIMentions("@qwen please review this");
    expect(results[0].agentHandle).toBe("qwen");
  });

  it("detects multiple different agents in one string", async () => {
    const results = await extractAIMentions("@llama @qwen both respond");
    const handles = results.map((r) => r.agentHandle).sort();
    expect(handles).toEqual(["llama", "qwen"]);
  });

  it("does NOT produce duplicates when the same handle appears twice", async () => {
    const results = await extractAIMentions("@llama and @llama again");
    expect(results.filter((r) => r.agentHandle === "llama")).toHaveLength(1);
  });

  it("is case-insensitive — @LLAMA matches llama", async () => {
    const results = await extractAIMentions("@LLAMA check this out");
    expect(results).toHaveLength(1);
    expect(results[0].agentHandle).toBe("llama");
  });

  it("is case-insensitive — @GPT-OSS matches gpt-oss", async () => {
    const results = await extractAIMentions("@GPT-OSS synthesise please");
    expect(results[0].agentHandle).toBe("gpt-oss");
  });
});

describe("extractAIMentions — email address exclusion", () => {
  beforeEach(() => vi.clearAllMocks());

  it("does NOT match email addresses (hi@llama.dev is not a mention)", async () => {
    const results = await extractAIMentions("email me at hi@llama.dev");
    expect(results).toHaveLength(0);
  });

  it("does NOT match email@gpt-oss.ai", async () => {
    const results = await extractAIMentions("contact user@gpt-oss.ai for help");
    expect(results).toHaveLength(0);
  });

  it("correctly handles text that has both an email and a real mention", async () => {
    const results = await extractAIMentions("send to user@llama.dev then ask @qwen");
    expect(results).toHaveLength(1);
    expect(results[0].agentHandle).toBe("qwen");
  });
});

describe("extractAIMentions — @ai / @random random selection", () => {
  beforeEach(() => vi.clearAllMocks());

  it("@ai triggers random participant selection (DB mock returns all available)", async () => {
    // mockWhere returns [] by default → all 3 participants are available (0 < dailyLimit)
    const results = await extractAIMentions("@ai what do you think?");
    expect(results).toHaveLength(1);
    expect(results[0].isRandomSelection).toBe(true);
    expect(["llama", "gpt-oss", "qwen"]).toContain(results[0].agentHandle);
  });

  it("@random also triggers random selection", async () => {
    const results = await extractAIMentions("@random give me feedback");
    expect(results).toHaveLength(1);
    expect(results[0].isRandomSelection).toBe(true);
  });

  it("caps @ai resolutions at 1 per comment (second @ai doesn't add another)", async () => {
    const results = await extractAIMentions("@ai and @ai again");
    const randomOnes = results.filter((r) => r.isRandomSelection);
    expect(randomOnes).toHaveLength(1);
  });

  it("returns empty when no mentions present", async () => {
    const results = await extractAIMentions("no mentions here, just plain text");
    expect(results).toHaveLength(0);
  });

  it("@ai returns empty when all participants are rate-limited (DB returns full usage)", async () => {
    // Simulate all 3 participants at their daily limit (15 requests each)
    mockWhere.mockResolvedValueOnce([
      { agentId: "ai_llama",   requestCount: 15 },
      { agentId: "ai_gpt_oss", requestCount: 15 },
      { agentId: "ai_qwen",    requestCount: 15 },
    ]);

    const results = await extractAIMentions("@ai thoughts?");
    const randomOnes = results.filter((r) => r.isRandomSelection);
    expect(randomOnes).toHaveLength(0);
  });
});
