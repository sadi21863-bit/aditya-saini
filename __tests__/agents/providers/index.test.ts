import { vi, describe, it, expect, beforeEach } from "vitest";

const mockCallGroq     = vi.hoisted(() => vi.fn());
const mockCallCerebras = vi.hoisted(() => vi.fn());
const mockCallGitHub   = vi.hoisted(() => vi.fn());

vi.mock("@/lib/agents/providers/groq", () => ({
  callGroq: mockCallGroq,
}));

vi.mock("@/lib/agents/providers/cerebras", () => ({
  callCerebras:         mockCallCerebras,
  // callCerebrasFallback is unused in the production path; keep mock for import compat
  callCerebrasFallback: vi.fn(),
}));

vi.mock("@/lib/agents/providers/github", () => ({
  callGitHub: mockCallGitHub,
}));

import { callAgent } from "@/lib/agents/providers/index";
import type { Agent } from "@/lib/agents/personas";

// ─── Test fixtures ────────────────────────────────────────────────────

const groqAgent: Agent = {
  id:         "ai_llama",
  name:       "Llama",
  handle:     "llama",
  provider:   "groq",
  model:      "llama-3.3-70b-versatile",
  role:       "participant",
  persona:    "You are Llama.",
  dailyLimit: 15,
  avatar:     "/agents/llama.png",
};

// cerebrasAgent represents a hypothetical future Cerebras agent (routing logic test only).
// No live agent currently uses provider === "cerebras".
const cerebrasAgent: Agent = {
  id:         "ai_cerebras_test",
  name:       "CerebrasTest",
  handle:     "cerebras-test",
  provider:   "cerebras",
  model:      "some-cerebras-model",
  role:       "participant",
  persona:    "You are a Cerebras agent.",
  dailyLimit: 5,
  avatar:     "/agents/placeholder.png",
};

const githubAgent: Agent = {
  id:         "ai_qwen",
  name:       "Qwen",
  handle:     "qwen",
  provider:   "github",
  model:      "meta/llama-4-scout-17b-16e-instruct",
  role:       "participant",
  persona:    "You are Qwen.",
  dailyLimit: 15,
  avatar:     "/agents/qwen.png",
};

// ─── Tests ───────────────────────────────────────────────────────────

describe("callAgent — Cerebras provider routing", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls Cerebras directly with agent.model, never touches Groq or GitHub", async () => {
    mockCallCerebras.mockResolvedValueOnce("cerebras response");

    const result = await callAgent(cerebrasAgent, "What do you think?");

    expect(mockCallCerebras).toHaveBeenCalledOnce();
    expect(mockCallCerebras).toHaveBeenCalledWith(
      cerebrasAgent.model,
      cerebrasAgent.persona,
      "What do you think?",
      undefined
    );
    expect(mockCallGroq).not.toHaveBeenCalled();
    expect(mockCallGitHub).not.toHaveBeenCalled();
    expect(result).toBe("cerebras response");
  });
});

describe("callAgent — GitHub Models provider routing (Qwen participant)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls GitHub directly with agent.model, never touches Groq or Cerebras", async () => {
    mockCallGitHub.mockResolvedValueOnce("qwen says hi");

    const result = await callAgent(githubAgent, "What is your take?");

    expect(mockCallGitHub).toHaveBeenCalledOnce();
    expect(mockCallGitHub).toHaveBeenCalledWith(
      githubAgent.model,
      githubAgent.persona,
      "What is your take?",
      undefined
    );
    expect(mockCallGroq).not.toHaveBeenCalled();
    expect(mockCallCerebras).not.toHaveBeenCalled();
    expect(result).toBe("qwen says hi");
  });

  it("strips thinking tags from GitHub response", async () => {
    mockCallGitHub.mockResolvedValueOnce("<think>reasoning</think>The real take.");

    const result = await callAgent(githubAgent, "prompt");
    expect(result).toBe("The real take.");
  });

  it("falls back to Groq llama-3.1-8b-instant when GitHub Models returns 429", async () => {
    const rateLimitErr = Object.assign(new Error("rate limit exceeded"), { status: 429 });
    mockCallGitHub.mockRejectedValueOnce(rateLimitErr);
    mockCallGroq.mockResolvedValueOnce("fallback response");

    const result = await callAgent(githubAgent, "test prompt");

    expect(mockCallGroq).toHaveBeenCalledWith(
      "llama-3.1-8b-instant",
      githubAgent.persona,
      "test prompt",
      expect.objectContaining({ maxTokens: 600 }),
    );
    expect(result).toBe("fallback response");
  });
});

describe("callAgent — Groq primary agents (success path)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls Groq and returns without touching Cerebras on success", async () => {
    mockCallGroq.mockResolvedValueOnce("groq response");

    const result = await callAgent(groqAgent, "What do you think?");

    expect(mockCallGroq).toHaveBeenCalledOnce();
    expect(mockCallGroq).toHaveBeenCalledWith(
      groqAgent.model,
      groqAgent.persona,
      "What do you think?",
      expect.anything()
    );
    expect(mockCallCerebras).not.toHaveBeenCalled();
    expect(result).toBe("groq response");
  });
});

describe("callAgent — Groq fallback on transient errors", () => {
  beforeEach(() => vi.clearAllMocks());

  it("falls back to Groq llama-3.1-8b-instant on 429 rate-limit error", async () => {
    const rateLimitErr = Object.assign(new Error("rate limit"), { status: 429 });
    mockCallGroq
      .mockRejectedValueOnce(rateLimitErr)
      .mockResolvedValueOnce("fallback answer");

    const result = await callAgent(groqAgent, "prompt");

    expect(mockCallGroq).toHaveBeenCalledTimes(2);
    expect(mockCallGroq).toHaveBeenNthCalledWith(
      2,
      "llama-3.1-8b-instant",
      groqAgent.persona,
      "prompt",
      expect.objectContaining({ maxTokens: 600 })
    );
    expect(mockCallCerebras).not.toHaveBeenCalled();
    expect(result).toBe("fallback answer");
  });

  it("falls back to Groq llama-3.1-8b-instant on 503 server error", async () => {
    const serverErr = Object.assign(new Error("service unavailable"), { status: 503 });
    mockCallGroq
      .mockRejectedValueOnce(serverErr)
      .mockResolvedValueOnce("fallback ok");

    const result = await callAgent(groqAgent, "prompt");

    expect(mockCallGroq).toHaveBeenCalledTimes(2);
    expect(mockCallGroq).toHaveBeenNthCalledWith(2,
      "llama-3.1-8b-instant",
      expect.any(String),
      "prompt",
      expect.objectContaining({ maxTokens: 600 })
    );
    expect(result).toBe("fallback ok");
  });

  it("falls back on network timeout error (ETIMEDOUT in message)", async () => {
    const timeoutErr = new Error("ETIMEDOUT: connection timed out");
    mockCallGroq
      .mockRejectedValueOnce(timeoutErr)
      .mockResolvedValueOnce("ok");

    await callAgent(groqAgent, "prompt");

    expect(mockCallGroq).toHaveBeenCalledTimes(2);
    expect(mockCallGroq).toHaveBeenNthCalledWith(2,
      "llama-3.1-8b-instant",
      expect.any(String),
      "prompt",
      expect.objectContaining({ maxTokens: 600 })
    );
  });

  it("does NOT fall back on 401 auth error — propagates original error", async () => {
    const authErr = Object.assign(new Error("invalid api key"), { status: 401 });
    mockCallGroq.mockRejectedValueOnce(authErr);

    await expect(callAgent(groqAgent, "prompt")).rejects.toThrow("invalid api key");
    expect(mockCallGroq).toHaveBeenCalledOnce();
  });

  it("does NOT fall back on 400 bad request — propagates original error", async () => {
    const badReqErr = Object.assign(new Error("bad request"), { status: 400 });
    mockCallGroq.mockRejectedValueOnce(badReqErr);

    await expect(callAgent(groqAgent, "prompt")).rejects.toThrow("bad request");
    expect(mockCallGroq).toHaveBeenCalledOnce();
  });

  it("throws original error when fallback also fails", async () => {
    const rateLimitErr = Object.assign(new Error("rate limit"), { status: 429 });
    const fallbackErr  = Object.assign(new Error("fallback failed"), { status: 503 });
    mockCallGroq
      .mockRejectedValueOnce(rateLimitErr)
      .mockRejectedValueOnce(fallbackErr);

    await expect(callAgent(groqAgent, "prompt")).rejects.toThrow("rate limit");
    expect(mockCallGroq).toHaveBeenCalledTimes(2);
  });

  it("fallback works even without CEREBRAS_API_KEY set", async () => {
    const original = process.env.CEREBRAS_API_KEY;
    delete process.env.CEREBRAS_API_KEY;

    const rateLimitErr = Object.assign(new Error("rate limit"), { status: 429 });
    mockCallGroq
      .mockRejectedValueOnce(rateLimitErr)
      .mockResolvedValueOnce("groq fallback ok");

    const result = await callAgent(groqAgent, "prompt");
    expect(result).toBe("groq fallback ok");
    expect(mockCallGroq).toHaveBeenCalledTimes(2);

    process.env.CEREBRAS_API_KEY = original;
  });
});
