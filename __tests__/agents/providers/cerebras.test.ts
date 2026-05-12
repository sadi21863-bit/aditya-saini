import { vi, describe, it, expect, beforeEach } from "vitest";

const mockCreate = vi.hoisted(() => vi.fn());

vi.mock("openai", () => ({
  default: vi.fn(function (this: Record<string, unknown>, _config: unknown) {
    this.chat = { completions: { create: mockCreate } };
  }),
}));

import OpenAI from "openai";
import { callCerebras } from "@/lib/agents/providers/cerebras";

const MockedOpenAI = vi.mocked(OpenAI);

// Constructor is lazy — triggered on first callCerebras invocation
describe("callCerebras — client initialization", () => {
  it("creates the OpenAI client pointed at api.cerebras.ai/v1", async () => {
    mockCreate.mockResolvedValueOnce({ choices: [{ message: { content: "ok" } }] });
    await callCerebras("some-model", "sys", "usr");
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
      }),
      expect.anything()
    );
    expect(result).toBe("cerebras says hi");
  });

  it("defaults temperature to 0.8 and max_tokens to 600", async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: "ok" } }],
    });

    await callCerebras("any-model", "sys", "usr");

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ temperature: 0.8, max_tokens: 600 }),
      expect.anything()
    );
  });

  it("respects custom opts", async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: "ok" } }],
    });

    await callCerebras("model", "sys", "usr", { temperature: 0.3, maxTokens: 300 });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ temperature: 0.3, max_tokens: 300 }),
      expect.anything()
    );
  });
});

