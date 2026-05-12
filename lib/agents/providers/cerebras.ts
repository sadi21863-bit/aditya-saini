import OpenAI from "openai";

// Lazy-initialized so module import during `next build` doesn't throw when
// CEREBRAS_API_KEY is not set in the build environment (only needed at runtime).
let _cerebras: OpenAI | null = null;
function getCerebras(): OpenAI {
  if (!_cerebras) {
    _cerebras = new OpenAI({
      apiKey:  process.env.CEREBRAS_API_KEY,
      baseURL: "https://api.cerebras.ai/v1",
    });
  }
  return _cerebras;
}

/** Kept for potential future use — currently unused (2026-05-04).
 *
 * After Week 6 Phase A migration:
 *   - Fallback moved to Groq llama-3.1-8b-instant (callCerebrasFallback no longer called)
 *   - Qwen participant migrated off Cerebras (qwen-3-235b-a22b-instruct-2507 deprecates 2026-05-27)
 *   - Cerebras has NO active role in the AI Lab as of this date.
 *
 * Revisit if Cerebras restores gpt-oss-120b on the free tier.
 */
const FALLBACK_MODEL_ID = process.env.AGENT_MODEL_FALLBACK ?? "llama3.1-8b";

export async function callCerebras(
  modelId: string,
  system: string,
  user: string,
  opts: { temperature?: number; maxTokens?: number } = {}
): Promise<string> {
  const resp = await getCerebras().chat.completions.create({
    model: modelId,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: opts.temperature ?? 0.8,
    max_tokens: opts.maxTokens ?? 600,
    stream:     false,
  }, { signal: AbortSignal.timeout(30_000) });
  // Cast through unknown: create() returns ChatCompletion|Stream union; we never use streaming.
  const result = resp as unknown as { choices: Array<{ message: { content: string | null } }> };
  return result.choices[0]?.message?.content ?? "";
}

/** Currently unused — Groq is the fallback provider. Revisit when Cerebras restores gpt-oss-120b free tier. */
export async function callCerebrasFallback(
  system: string,
  user: string,
  opts: { temperature?: number; maxTokens?: number } = {}
): Promise<string> {
  return callCerebras(FALLBACK_MODEL_ID, system, user, opts);
}
