import { describe, it, expect } from "vitest";
import { stripThinkingTags, normalizeHyphens } from "@/lib/agents/response-cleaner";

describe("stripThinkingTags", () => {
  // ─── Paired tags ──────────────────────────────────────────────────────

  it("removes a <think>...</think> block and returns the remaining text", () => {
    const input = "<think>scratch work here</think>Final answer.";
    expect(stripThinkingTags(input)).toBe("Final answer.");
  });

  it("removes a <thinking>...</thinking> block", () => {
    const input = "<thinking>internal monologue</thinking>Here is my response.";
    expect(stripThinkingTags(input)).toBe("Here is my response.");
  });

  it("removes a <reasoning>...</reasoning> block", () => {
    const input = "<reasoning>step 1, step 2</reasoning>Conclusion.";
    expect(stripThinkingTags(input)).toBe("Conclusion.");
  });

  it("strips leading/trailing whitespace after removal", () => {
    const input = "<think>scratch</think>  \n  Hello there.  ";
    expect(stripThinkingTags(input)).toBe("Hello there.");
  });

  it("removes multiple separate thinking blocks, keeps prose between them", () => {
    const input = "<think>first</think>Middle prose.<think>second</think>End.";
    expect(stripThinkingTags(input)).toBe("Middle prose.End.");
  });

  it("handles a thinking block with multi-line content", () => {
    const input = "<think>\nline one\nline two\nline three\n</think>The real answer.";
    expect(stripThinkingTags(input)).toBe("The real answer.");
  });

  // ─── Case variants ────────────────────────────────────────────────────

  it("is case-insensitive: <THINK>...</THINK>", () => {
    const input = "<THINK>ignored</THINK>Visible output.";
    expect(stripThinkingTags(input)).toBe("Visible output.");
  });

  it("is case-insensitive: <Thinking>...</Thinking>", () => {
    const input = "<Thinking>internal</Thinking>Response here.";
    expect(stripThinkingTags(input)).toBe("Response here.");
  });

  it("is case-insensitive: <REASONING>...</REASONING>", () => {
    const input = "<REASONING>logic</REASONING>Answer.";
    expect(stripThinkingTags(input)).toBe("Answer.");
  });

  // ─── Unclosed tags ────────────────────────────────────────────────────

  it("removes an unclosed <think> tag and everything after it", () => {
    const input = "Good start. <think>reasoning that was never closed";
    expect(stripThinkingTags(input)).toBe("Good start.");
  });

  it("removes an unclosed <thinking> block at end of string", () => {
    const input = "Preamble. <thinking>stream of consciousness without closing";
    expect(stripThinkingTags(input)).toBe("Preamble.");
  });

  it("returns empty string if the entire text is an unclosed thinking block", () => {
    const input = "<think>everything is scratch work with no closing tag";
    expect(stripThinkingTags(input)).toBe("");
  });

  // ─── Content inside tags (nested angle brackets, code, etc.) ──────────

  it("handles angle brackets inside the thinking block without breaking", () => {
    const input = "<think>x < y && a > b</think>Result is valid.";
    expect(stripThinkingTags(input)).toBe("Result is valid.");
  });

  it("handles HTML-like content inside the block", () => {
    const input = "<think><p>some html</p><ul><li>item</li></ul></think>Clean output.";
    expect(stripThinkingTags(input)).toBe("Clean output.");
  });

  it("does NOT strip arbitrary unrelated XML/HTML tags", () => {
    const input = "Response with <b>bold</b> and <em>emphasis</em>.";
    expect(stripThinkingTags(input)).toBe("Response with <b>bold</b> and <em>emphasis</em>.");
  });

  // ─── Edge cases ───────────────────────────────────────────────────────

  it("returns empty string for empty input", () => {
    expect(stripThinkingTags("")).toBe("");
  });

  it("returns the original text unchanged when no thinking tags are present", () => {
    const input = "This is a perfectly normal response with no tags.";
    expect(stripThinkingTags(input)).toBe(input);
  });

  it("returns empty string when the entire input is a closed thinking block", () => {
    const input = "<think>only scratch work, nothing else</think>";
    expect(stripThinkingTags(input)).toBe("");
  });

  it("handles whitespace-only content after tag removal by returning empty string", () => {
    const input = "   <think>stuff</think>   ";
    expect(stripThinkingTags(input)).toBe("");
  });

  it("handles a real Groq Qwen3 response format (preamble + answer)", () => {
    const groqReal = `<think>
Okay, the user wants me to say hello and confirm I'm working.
Let me start with a friendly greeting. "Hello! I'm here and ready to help."
That should cover both parts. Keep it simple and clear.
</think>
Hello! I'm here and ready to help.`;

    expect(stripThinkingTags(groqReal)).toBe("Hello! I'm here and ready to help.");
  });
});

// ─── normalizeHyphens ──────────────────────────────────────────────────────
// GPT-OSS (Groq) emits non-breaking hyphens in narrative text.
// These need normalizing before storage so string comparisons work correctly.

describe("normalizeHyphens", () => {
  it("replaces non-breaking hyphen (U+2011) with regular hyphen-minus", () => {
    expect(normalizeHyphens("safety‑speed tradeoff")).toBe("safety-speed tradeoff");
  });

  it("replaces figure dash (U+2012) with regular hyphen-minus", () => {
    expect(normalizeHyphens("cost‒benefit analysis")).toBe("cost-benefit analysis");
  });

  it("leaves regular hyphens and em-dashes unchanged", () => {
    const text = "well-known fact — not a tradeoff";
    expect(normalizeHyphens(text)).toBe(text);
  });
});
