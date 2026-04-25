import { vi, describe, it, expect, beforeEach } from "vitest";

const mockCreate = vi.hoisted(() => vi.fn());

vi.mock("openai", () => ({
  default: vi.fn(function (this: Record<string, unknown>, _config: unknown) {
    this.chat = { completions: { create: mockCreate } };
  }),
}));

import OpenAI from "openai";
import { callCerebras, callCerebrasFallback } from "@/lib/agents/providers/cerebras";

const MockedOpenAI = vi.mocked(OpenAI);

describe("callCerebras — client initialization", () => {
  it("creates the OpenAI client pointed at api.cerebras.ai/v1", () => {
    expect(MockedOpenAI).toHaveBeenCalledWith(
      expect.objectContaining({ baseURL: "https://api.cerebras.ai/v1" })
    );
  });
});

describe("callCerebras — primary usage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends the supplied modelId, system, and user", async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: "cerebras says hi" } }],
    });

    const result = await callCerebras(
      "qwen-3-235b-a22b-instruct-2507",
      "You are the Archivist.",
      "Summarise today"
    );

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "qwen-3-235b-a22b-instruct-2507",
        messages: [
          { role: "system", content: "You are the Archivist." },
          { role: "user",   content: "Summarise today" },
        ],
      })
    );
    expect(result).toBe("cerebras says hi");
  });

  it("defaults temperature to 0.8 and max_tokens to 600", async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: "ok" } }],
    });

    await callCerebras("any-model", "sys", "usr");

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ temperature: 0.8, max_tokens: 600 })
    );
  });

  it("respects custom opts", async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: "ok" } }],
    });

    await callCerebras("model", "sys", "usr", { temperature: 0.3, maxTokens: 300 });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ temperature: 0.3, max_tokens: 300 })
    );
  });
});

describe("callCerebrasFallback", () => {
  beforeEach(() => vi.clearAllMocks());

  it("always uses llama3.1-8b (FALLBACK_MODEL_ID default)", async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: "fallback ok" } }],
    });

    const result = await callCerebrasFallback("system prompt", "user prompt");

    // env var AGENT_MODEL_FALLBACK is not set in test env → default is llama3.1-8b
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: "llama3.1-8b" })
    );
    expect(result).toBe("fallback ok");
  });

  it("does NOT use qwen-3-235b or any primary model (always fixed fallback)", async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: "ok" } }],
    });

    await callCerebrasFallback("system", "user");

    const call = mockCreate.mock.calls[0][0] as { model: string };
    expect(call.model).toBe("llama3.1-8b");
    expect(call.model).not.toContain("qwen-3-235b");
    expect(call.model).not.toContain("gpt-oss");
  });

  it("returns the response content correctly", async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: "rescued content" } }],
    });

    const result = await callCerebrasFallback("sys", "usr");
    expect(result).toBe("rescued content");
  });
});
