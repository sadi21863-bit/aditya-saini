import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

const mockCallGroq             = vi.hoisted(() => vi.fn());
const mockCallCerebras         = vi.hoisted(() => vi.fn());
const mockCallCerebrasFallback = vi.hoisted(() => vi.fn());

vi.mock("@/lib/agents/providers/groq", () => ({
  callGroq: mockCallGroq,
}));

vi.mock("@/lib/agents/providers/cerebras", () => ({
  callCerebras:         mockCallCerebras,
  callCerebrasFallback: mockCallCerebrasFallback,
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

const cerebrasAgent: Agent = {
  id:         "ai_archivist",
  name:       "Archivist",
  handle:     "archivist",
  provider:   "cerebras",
  model:      "qwen-3-235b-a22b-instruct-2507",
  role:       "archivist",
  persona:    "You are the Archivist.",
  dailyLimit: 3,
  avatar:     "/agents/archivist.png",
};

// ─── Tests ───────────────────────────────────────────────────────────

describe("callAgent — Cerebras primary agents", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls Cerebras directly with agent.model, never touches Groq", async () => {
    mockCallCerebras.mockResolvedValueOnce("archive summary");

    const result = await callAgent(cerebrasAgent, "Summarise today");

    expect(mockCallCerebras).toHaveBeenCalledOnce();
    expect(mockCallCerebras).toHaveBeenCalledWith(
      cerebrasAgent.model,
      cerebrasAgent.persona,
      "Summarise today",
      undefined
    );
    expect(mockCallGroq).not.toHaveBeenCalled();
    expect(result).toBe("archive summary");
  });
});

describe("callAgent — Groq primary agents (success path)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls Groq and returns without touching Cerebras on success", async () => {
    mockCallGroq.mockResolvedValueOnce("groq response");

    const result = await callAgent(groqAgent, "What do you think?");

    expect(mockCallGroq).toHaveBeenCalledOnce();
    // callAgent always passes an opts object (may be empty after per-model overrides)
    expect(mockCallGroq).toHaveBeenCalledWith(
      groqAgent.model,
      groqAgent.persona,
      "What do you think?",
      expect.anything()
    );
    expect(mockCallCerebrasFallback).not.toHaveBeenCalled();
    expect(result).toBe("groq response");
  });
});

describe("callAgent — Groq fallback on transient errors", () => {
  const originalCerebraKey = process.env.CEREBRAS_API_KEY;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CEREBRAS_API_KEY = "test-cerebras-key";
  });

  afterEach(() => {
    process.env.CEREBRAS_API_KEY = originalCerebraKey;
  });

  it("falls back to Cerebras llama3.1-8b on Groq 429 rate-limit error", async () => {
    const rateLimitErr = Object.assign(new Error("rate limit"), { status: 429 });
    mockCallGroq.mockRejectedValueOnce(rateLimitErr);
    mockCallCerebrasFallback.mockResolvedValueOnce("fallback answer");

    const result = await callAgent(groqAgent, "prompt");

    expect(mockCallGroq).toHaveBeenCalledOnce();
    expect(mockCallCerebrasFallback).toHaveBeenCalledOnce();
    expect(result).toBe("fallback answer");
  });

  it("falls back to Cerebras on Groq 503 server error", async () => {
    const serverErr = Object.assign(new Error("service unavailable"), { status: 503 });
    mockCallGroq.mockRejectedValueOnce(serverErr);
    mockCallCerebrasFallback.mockResolvedValueOnce("fallback ok");

    const result = await callAgent(groqAgent, "prompt");

    expect(mockCallCerebrasFallback).toHaveBeenCalledOnce();
    expect(result).toBe("fallback ok");
  });

  it("falls back on network timeout error (ETIMEDOUT in message)", async () => {
    const timeoutErr = new Error("ETIMEDOUT: connection timed out");
    mockCallGroq.mockRejectedValueOnce(timeoutErr);
    mockCallCerebrasFallback.mockResolvedValueOnce("ok");

    await callAgent(groqAgent, "prompt");

    expect(mockCallCerebrasFallback).toHaveBeenCalledOnce();
  });

  it("does NOT fall back on 401 auth error — propagates original error", async () => {
    const authErr = Object.assign(new Error("invalid api key"), { status: 401 });
    mockCallGroq.mockRejectedValueOnce(authErr);

    await expect(callAgent(groqAgent, "prompt")).rejects.toThrow("invalid api key");
    expect(mockCallCerebrasFallback).not.toHaveBeenCalled();
  });

  it("does NOT fall back on 400 bad request — propagates original error", async () => {
    const badReqErr = Object.assign(new Error("bad request"), { status: 400 });
    mockCallGroq.mockRejectedValueOnce(badReqErr);

    await expect(callAgent(groqAgent, "prompt")).rejects.toThrow("bad request");
    expect(mockCallCerebrasFallback).not.toHaveBeenCalled();
  });
});

describe("callAgent — CEREBRAS_API_KEY unset", () => {
  const originalCerebraKey = process.env.CEREBRAS_API_KEY;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.CEREBRAS_API_KEY;
  });

  afterEach(() => {
    process.env.CEREBRAS_API_KEY = originalCerebraKey;
  });

  it("propagates the original Groq error when CEREBRAS_API_KEY is not set", async () => {
    const rateLimitErr = Object.assign(new Error("rate limit"), { status: 429 });
    mockCallGroq.mockRejectedValueOnce(rateLimitErr);

    await expect(callAgent(groqAgent, "prompt")).rejects.toThrow("rate limit");
    expect(mockCallCerebrasFallback).not.toHaveBeenCalled();
  });
});
