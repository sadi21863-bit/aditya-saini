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

/** Fallback model ID map.
 *
 * In v4.2, Cerebras serves two purposes:
 *   1. PRIMARY provider for Archivist (qwen-3-235b-a22b-instruct-2507) and
 *      Qwen participant (same model). Called directly via provider="cerebras".
 *   2. FALLBACK for Groq failures. In fallback mode we always route to
 *      llama3.1-8b — a production model with 1M TPD that is always available.
 *
 * Verified April 24, 2026 against actual Cerebras dashboard:
 *   - llama3.1-8b (production, 1M TPD, 14.4K RPD) — always available
 *   - qwen-3-235b-a22b-instruct-2507 (preview, 1M TPD, 14.4K RPD)
 *
 * Since no Groq model we use has a 1:1 Cerebras equivalent, we route
 * ALL fallback requests to llama3.1-8b as a safe, always-available rescue
 * path. Quality may drop, but the Lab stays operational during Groq outages.
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
  });
  // Cast through unknown: create() returns ChatCompletion|Stream union; we never use streaming.
  const result = resp as unknown as { choices: Array<{ message: { content: string | null } }> };
  return result.choices[0]?.message?.content ?? "";
}

/** Used specifically by fallback logic in index.ts — always uses FALLBACK_MODEL_ID. */
export async function callCerebrasFallback(
  system: string,
  user: string,
  opts: { temperature?: number; maxTokens?: number } = {}
): Promise<string> {
  return callCerebras(FALLBACK_MODEL_ID, system, user, opts);
}
