import { callGroq } from "./groq";
import { callCerebras } from "./cerebras";
import { callGitHub } from "./github";
import { stripThinkingTags, normalizeHyphens } from "../response-cleaner";
import type { Agent } from "../personas";

/** Errors that should trigger fallback to the small Groq model. */
function isTransientError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message.toLowerCase() : "";
  const status = (err as { status?: number })?.status;
  // 429 = rate limit, 5xx = server error, ETIMEDOUT/ECONNRESET = network
  if (status === 429 || (status && status >= 500 && status < 600)) return true;
  return /rate.?limit|timeout|econnreset|etimedout|service unavailable/.test(msg);
}

// Models that support response_format: { type: "json_object" } on Groq.
// Verified 2026-04-25: llama-3.3-70b-versatile supports it.
// qwen/qwen3-32b and openai/gpt-oss-120b both 400 — reasoning models whose
// thinking-tag output fails Groq's JSON validator.
const JSON_MODE_SUPPORTED = new Set(["llama-3.3-70b-versatile"]);

// GPT-OSS is a reasoning model that can consume many tokens on chain-of-thought
// before producing visible output. Raise its floor to avoid empty responses.
const GPTOSS_MODEL = "openai/gpt-oss-120b";
// Raised 1200 → 2500: post_idea requires 500–800 tokens of JSON output (title +
// pitch + 200–500 word content field). GPT-OSS burns 400–800 tokens of internal
// chain-of-thought first. At 1200 the reasoning overhead exhausted the budget,
// truncating the JSON and causing every post_idea to fail with "Invalid JSON".
// Comments worked because their output (~300 tokens) fit within the old floor.
// Extra headroom for short outputs costs nothing — models stop when done.
const GPTOSS_MIN_TOKENS = 2500;

export async function callAgent(
  agent: Agent,
  userPrompt: string,
  opts?: { temperature?: number; maxTokens?: number; jsonMode?: boolean }
): Promise<string> {
  // Cerebras agents call Cerebras directly.
  if (agent.provider === "cerebras") {
    return stripThinkingTags(
      await callCerebras(agent.model, agent.persona, userPrompt, opts)
    );
  }

  // GitHub Models agents (Qwen participant — meta/llama-4-scout-17b-16e-instruct).
  // On transient errors (429, 5xx, network), fall back to Groq llama-3.1-8b-instant.
  if (agent.provider === "github") {
    try {
      return normalizeHyphens(stripThinkingTags(
        await callGitHub(agent.model, agent.persona, userPrompt, opts)
      ));
    } catch (err) {
      if (!isTransientError(err)) throw err;
      try {
        console.warn(
          `[ai-lab] GitHub Models failed for ${agent.handle} (${agent.model}); falling back to Groq llama-3.1-8b-instant. Error: ${(err as Error).message}`
        );
        return normalizeHyphens(stripThinkingTags(
          await callGroq("llama-3.1-8b-instant", agent.persona, userPrompt, { ...opts, maxTokens: 600 })
        ));
      } catch (fallbackErr) {
        console.error(
          `[ai-lab] Groq fallback (llama-3.1-8b-instant) also failed for ${agent.handle}: ${(fallbackErr as Error).message}`
        );
        throw err;
      }
    }
  }

  // Per-model overrides before calling Groq
  const groqOpts = { ...opts };
  if (groqOpts.jsonMode && !JSON_MODE_SUPPORTED.has(agent.model)) {
    // Don't forward jsonMode for models that don't support it
    delete groqOpts.jsonMode;
  }
  // Use opts.maxTokens if given; else fall back to agent.maxTokens; else GPTOSS_MIN_TOKENS floor.
  if (!groqOpts.maxTokens) {
    groqOpts.maxTokens = agent.maxTokens
      ?? (agent.model === GPTOSS_MODEL ? GPTOSS_MIN_TOKENS : undefined);
  }

  // Groq agents (Theme Setter, Quality Checker, Llama, GPT-OSS) try Groq first.
  // On transient errors, fall back to Groq llama-3.1-8b-instant as safety net.
  // (Cerebras fallback retired 2026-05-27 when llama3.1-8b on Cerebras deprecates.)
  try {
    // normalizeHyphens: GPT-OSS emits U+2011/U+2012 non-breaking hyphens in narrative text.
    // Normalize to standard hyphen-minus before storage.
    return normalizeHyphens(stripThinkingTags(
      await callGroq(agent.model, agent.persona, userPrompt, groqOpts)
    ));
  } catch (err) {
    if (!isTransientError(err)) throw err;

    try {
      console.warn(
        `[ai-lab] Groq failed for ${agent.handle} (${agent.model}); falling back to Groq llama-3.1-8b-instant. Error: ${(err as Error).message}`
      );
      return normalizeHyphens(stripThinkingTags(
        await callGroq("llama-3.1-8b-instant", agent.persona, userPrompt, { ...opts, maxTokens: 600 })
      ));
    } catch (fallbackErr) {
      console.error(
        `[ai-lab] Groq fallback (llama-3.1-8b-instant) also failed for ${agent.handle}: ${(fallbackErr as Error).message}`
      );
      throw err;
    }
  }
}
