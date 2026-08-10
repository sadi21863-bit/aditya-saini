import { callGroq } from "./groq";
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
// Re-verified 2026-07-16 via scripts/verify-groq-json-mode.ts against live Groq API
// (ahead of the qwen/qwen3-32b deprecation on 2026-07-17):
//   llama-3.3-70b-versatile   ✓ PASS (unchanged)
//   openai/gpt-oss-120b       ✓ PASS — no longer 400s; Groq's validator no longer
//                                trips on this model's reasoning-tag output.
//   openai/gpt-oss-20b        ✓ PASS
//   qwen/qwen3.6-27b          ✓ PASS, but preview-tier per Groq docs — not wired
//                                into production agent config, so omitted here.
const JSON_MODE_SUPPORTED = new Set([
  "llama-3.3-70b-versatile",
  "openai/gpt-oss-120b",
  "openai/gpt-oss-20b",
]);

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

// Fallback model for transient errors (GitHub Models down, Groq 429/5xx).
// llama-3.1-8b-instant → openai/gpt-oss-20b 2026-07-16, alongside the
// qwen/qwen3-32b deprecation cleanup (see JSON_MODE_SUPPORTED above for
// verification — gpt-oss-20b passes Groq's native JSON mode).
const FALLBACK_MODEL = process.env.AGENT_MODEL_FALLBACK ?? "openai/gpt-oss-20b";

export async function callAgent(
  agent: Agent,
  userPrompt: string,
  opts?: { temperature?: number; maxTokens?: number; jsonMode?: boolean }
): Promise<string> {
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
  // On transient errors, fall back to Groq FALLBACK_MODEL as safety net.
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
        `[ai-lab] Groq failed for ${agent.handle} (${agent.model}); falling back to Groq ${FALLBACK_MODEL}. Error: ${(err as Error).message}`
      );
      return normalizeHyphens(stripThinkingTags(
        await callGroq(FALLBACK_MODEL, agent.persona, userPrompt, { ...opts, maxTokens: 600 })
      ));
    } catch (fallbackErr) {
      console.error(
        `[ai-lab] Groq fallback (${FALLBACK_MODEL}) also failed for ${agent.handle}: ${(fallbackErr as Error).message}`
      );
      throw err;
    }
  }
}
