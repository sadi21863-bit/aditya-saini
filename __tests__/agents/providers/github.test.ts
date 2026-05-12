import { vi, describe, it, expect, beforeEach } from "vitest";

const mockCreate = vi.hoisted(() => vi.fn());

vi.mock("openai", () => ({
  default: vi.fn(function (this: Record<string, unknown>, _config: unknown) {
    this.chat = { completions: { create: mockCreate } };
  }),
}));

import OpenAI from "openai";
import { callGitHub } from "@/lib/agents/providers/github";

const MockedOpenAI = vi.mocked(OpenAI);

// Constructor is lazy — triggered on first callGitHub invocation
describe("callGitHub — client initialization", () => {
  it("creates the OpenAI client pointed at models.github.ai/inference", async () => {
    mockCreate.mockResolvedValueOnce({ choices: [{ message: { content: "ok" } }] });
    await callGitHub("some-model", "sys", "usr");
    expect(MockedOpenAI).toHaveBeenCalledWith(
      expect.objectContaining({ baseURL: "https://models.github.ai/inference" })
    );
  });
});

describe("callGitHub — primary usage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends the supplied model, system, and user", async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: "github says hi" } }],
    });

    const result = await callGitHub(
      "meta/llama-4-scout-17b-16e-instruct",
      "You are Qwen.",
      "What do you think?"
    );

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "meta/llama-4-scout-17b-16e-instruct",
        messages: [
          { role: "system", content: "You are Qwen." },
          { role: "user",   content: "What do you think?" },
        ],
      }),
      expect.anything()
    );
    expect(result).toBe("github says hi");
  });

  it("defaults temperature to 0.8 and max_tokens to 600", async () => {
    mockCreate.mockResolvedValueOnce({ choices: [{ message: { content: "ok" } }] });

    await callGitHub("any-model", "sys", "usr");

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ temperature: 0.8, max_tokens: 600 }),
      expect.anything()
    );
  });

  it("respects custom temperature and maxTokens", async () => {
    mockCreate.mockResolvedValueOnce({ choices: [{ message: { content: "ok" } }] });

    await callGitHub("model", "sys", "usr", { temperature: 0.5, maxTokens: 400 });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ temperature: 0.5, max_tokens: 400 }),
      expect.anything()
    );
  });

  it("returns empty string when content is null", async () => {
    mockCreate.mockResolvedValueOnce({ choices: [{ message: { content: null } }] });

    const result = await callGitHub("model", "sys", "usr");
    expect(result).toBe("");
  });

  it("returns empty string when choices array is empty", async () => {
    mockCreate.mockResolvedValueOnce({ choices: [] });

    const result = await callGitHub("model", "sys", "usr");
    expect(result).toBe("");
  });
});
