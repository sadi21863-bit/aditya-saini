import OpenAI from "openai";

// Lazy-initialized so module import during `next build` doesn't throw when
// GROQ_API_KEY is not set in the build environment (only needed at runtime).
let _groq: OpenAI | null = null;
function getGroq(): OpenAI {
  if (!_groq) {
    _groq = new OpenAI({
      apiKey:  process.env.GROQ_API_KEY,
      baseURL: "https://api.groq.com/openai/v1",
    });
  }
  return _groq;
}

export async function callGroq(
  model: string,
  system: string,
  user: string,
  opts: { temperature?: number; maxTokens?: number; jsonMode?: boolean } = {}
): Promise<string> {
  const groq = getGroq();
  const params: Parameters<typeof groq.chat.completions.create>[0] = {
    model,
    messages: [
      { role: "system", content: system },
      { role: "user",   content: user },
    ],
    temperature: opts.temperature ?? 0.8,
    max_tokens:  opts.maxTokens  ?? 600,
    stream:      false,
  };

  // response_format: { type: "json_object" } — Groq model support matrix.
  // Verified 2026-04-25 against live Groq API:
  //
  //   llama-3.3-70b-versatile    ✓ SUPPORTED — API-level JSON enforcement at sampling
  //   qwen/qwen3-32b             ✗ 400 error — reasoning model emits <think> before JSON;
  //                                Groq's validator rejects it (requires JSON from token 1)
  //   openai/gpt-oss-120b        ✗ 400 error — same root cause as Qwen3
  //
  // For unsupported models, rely on lib/agents/json-helpers.ts sanitizer + extractor.
  // For Qwen3 admin calls, /no_think in the persona reduces thinking tokens by ~93%.
  //
  // TODO (before Phase 3): centralise per-model config into lib/agents/model-config.ts
  // so adding new models in Phase 3 doesn't require auditing scattered conditionals.
  if (opts.jsonMode) {
    // @ts-ignore — response_format is valid per Groq's OpenAI-compatible API
    params.response_format = { type: "json_object" };
  }

  // Cast through unknown: create() returns ChatCompletion|Stream union; we never use streaming.
  const response = await groq.chat.completions.create(params, { signal: AbortSignal.timeout(30_000) }) as unknown as { choices: Array<{ message: { content: string | null } }> };
  return response.choices[0]?.message?.content ?? "";
}
