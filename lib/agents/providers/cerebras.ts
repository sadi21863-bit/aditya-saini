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
 * After Week 6 migration (2026-04-30), Cerebras serves one purpose:
 *   1. PRIMARY provider for Qwen participant (qwen-3-235b-a22b-instruct-2507).
 *      Archivist migrated to Groq GPT-OSS-120B.
 *   2. FALLBACK for Groq failures. Routes to llama3.1-8b.
 *
 * Model status (as of 2026-04-30):
 *   - llama3.1-8b (production, 1M TPD) — fallback; deprecates 2026-05-27
 *     Post-May-27 fallback target: llama-3.1-8b-instant on Groq
 *   - qwen-3-235b-a22b-instruct-2507 (preview) — Qwen participant; deprecates 2026-05-27
 *     Post-May-27 target: gpt-oss-120b on Cerebras (when free-tier access restored)
 *
 * Since no Groq model has a 1:1 Cerebras equivalent, we route ALL fallback
 * requests to llama3.1-8b. Quality may drop, but the Lab stays operational.
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
