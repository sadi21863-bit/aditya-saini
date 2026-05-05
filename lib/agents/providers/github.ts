import OpenAI from "openai";

// Lazy-initialized so module import during `next build` doesn't throw when
// GITHUB_TOKEN is not set in the build environment (only needed at runtime).
let _github: OpenAI | null = null;
function getGitHub(): OpenAI {
  if (!_github) {
    // GH_MODELS_TOKEN is used in GitHub Actions (GITHUB_TOKEN is reserved there).
    // GITHUB_TOKEN is used in Vercel and local dev.
    _github = new OpenAI({
      baseURL: "https://models.github.ai/inference",
      apiKey:  process.env.GH_MODELS_TOKEN ?? process.env.GITHUB_TOKEN ?? "",
    });
  }
  return _github;
}

export async function callGitHub(
  model: string,
  system: string,
  user: string,
  opts: { temperature?: number; maxTokens?: number } = {}
): Promise<string> {
  const resp = await getGitHub().chat.completions.create({
    model,
    messages: [
      { role: "system", content: system },
      { role: "user",   content: user },
    ],
    temperature: opts.temperature ?? 0.8,
    max_tokens:  opts.maxTokens  ?? 600,
    stream:      false,
  }) as unknown as { choices: Array<{ message: { content: string | null } }> };
  return resp.choices[0]?.message?.content ?? "";
}
