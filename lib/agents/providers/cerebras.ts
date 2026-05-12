import OpenAI from "openai";

// Lazy-initialized so module import during `next build` doesn't throw when
// CEREBRAS_API_KEY is not set in the build environment (only needed at runtime).
//
// @research migrated to GitHub Models gpt-4o-mini (2026-05-13); Cerebras llama3.1-8b
// deprecates 2026-05-27 and gpt-oss-120b returned 401 on the free tier.
// callCerebras is kept for future use if Cerebras restores viable free-tier models.
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
