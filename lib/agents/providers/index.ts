import { callGroq } from "./groq";
import { callCerebras, callCerebrasFallback } from "./cerebras";
import { stripThinkingTags } from "../response-cleaner";
import type { Agent } from "../personas";

/** Errors that should trigger fallback to Cerebras. */
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
const GPTOSS_MIN_TOKENS = 1200;

export async function callAgent(
  agent: Agent,
  userPrompt: string,
  opts?: { temperature?: number; maxTokens?: number; jsonMode?: boolean }
): Promise<string> {
  // Cerebras agents (Archivist, Qwen participant) call Cerebras directly.
  if (agent.provider === "cerebras") {
    return stripThinkingTags(
      await callCerebras(agent.model, agent.persona, userPrompt, opts)
    );
  }

  // Per-model overrides before calling Groq
  const groqOpts = { ...opts };
  if (groqOpts.jsonMode && !JSON_MODE_SUPPORTED.has(agent.model)) {
    // Don't forward jsonMode for models that don't support it
    delete groqOpts.jsonMode;
  }
  if (agent.model === GPTOSS_MODEL && !groqOpts.maxTokens) {
    groqOpts.maxTokens = GPTOSS_MIN_TOKENS;
  }

  // Groq agents (Theme Setter, Quality Checker, Llama, GPT-OSS) try Groq first.
  // On transient errors, fall back to Cerebras llama3.1-8b as safety net.
  try {
    return stripThinkingTags(
      await callGroq(agent.model, agent.persona, userPrompt, groqOpts)
    );
  } catch (err) {
    if (!isTransientError(err)) throw err;
    if (!process.env.CEREBRAS_API_KEY) throw err;

    try {
      console.warn(
        `[ai-lab] Groq failed for ${agent.handle} (${agent.model}); falling back to Cerebras llama3.1-8b. Error: ${(err as Error).message}`
      );
      return stripThinkingTags(
        await callCerebrasFallback(agent.persona, userPrompt, opts)
      );
    } catch (fallbackErr) {
      console.error(
        `[ai-lab] Cerebras fallback also failed for ${agent.handle}: ${(fallbackErr as Error).message}`
      );
      throw err;
    }
  }
}
