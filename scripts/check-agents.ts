import "dotenv/config";
import { ALL_AGENTS } from "../lib/agents/personas";
import OpenAI from "openai";

const PROBE_SYSTEM = "You are a test probe. Respond with exactly one word.";
const PROBE_USER   = "Say OK";

interface Result {
  id:       string;
  handle:   string;
  provider: string;
  model:    string;
  status:   "OK" | "FAIL";
  latencyMs: number;
  error?:   string;
}

function getGroqClient(): OpenAI {
  return new OpenAI({
    apiKey:  process.env.GROQ_API_KEY ?? "",
    baseURL: "https://api.groq.com/openai/v1",
  });
}

function getGitHubClient(): OpenAI {
  return new OpenAI({
    apiKey:  process.env.GH_MODELS_TOKEN ?? process.env.GITHUB_TOKEN ?? "",
    baseURL: "https://models.github.ai/inference",
  });
}

function getCerebrasClient(): OpenAI {
  return new OpenAI({
    apiKey:  process.env.CEREBRAS_API_KEY ?? "",
    baseURL: "https://api.cerebras.ai/v1",
  });
}

async function probe(
  client: OpenAI,
  model: string,
  maxTokens = 10,
  timeoutMs = 15_000
): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  const start = Date.now();
  try {
    await client.chat.completions.create(
      {
        model,
        messages: [
          { role: "system", content: PROBE_SYSTEM },
          { role: "user",   content: PROBE_USER },
        ],
        max_tokens: maxTokens,
        temperature: 0,
      },
      { signal: AbortSignal.timeout(timeoutMs) }
    );
    return { ok: true, latencyMs: Date.now() - start };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, latencyMs: Date.now() - start, error: msg };
  }
}

async function main() {
  console.log("\n🔍 IdeaConnect Agent Diagnostic\n");
  console.log(`ENV: GROQ_API_KEY     = ${process.env.GROQ_API_KEY     ? "✓ set" : "✗ MISSING"}`);
  console.log(`ENV: GITHUB_TOKEN     = ${process.env.GITHUB_TOKEN     ? "✓ set" : "✗ MISSING"}`);
  console.log(`ENV: GH_MODELS_TOKEN  = ${process.env.GH_MODELS_TOKEN  ? "✓ set" : "✗ MISSING"}`);
  console.log(`ENV: CEREBRAS_API_KEY = ${process.env.CEREBRAS_API_KEY ? "✓ set" : "✗ MISSING"}`);
  console.log("");

  const groq     = getGroqClient();
  const github   = getGitHubClient();
  const cerebras = getCerebrasClient();

  const results: Result[] = [];

  for (const agent of ALL_AGENTS) {
    process.stdout.write(`  Testing @${agent.handle.padEnd(16)} (${agent.provider.padEnd(8)}) ${agent.model} ... `);

    let client: OpenAI;
    switch (agent.provider) {
      case "groq":     client = groq;     break;
      case "github":   client = github;   break;
      case "cerebras": client = cerebras; break;
      default:
        console.log("SKIP (unknown provider)");
        continue;
    }

    const { ok, latencyMs, error } = await probe(client, agent.model);

    const statusStr = ok ? "✅ OK" : "❌ FAIL";
    console.log(`${statusStr} (${latencyMs}ms)${error ? ` — ${error.slice(0, 120)}` : ""}`);

    results.push({
      id:        agent.id,
      handle:    agent.handle,
      provider:  agent.provider,
      model:     agent.model,
      status:    ok ? "OK" : "FAIL",
      latencyMs,
      error,
    });
  }

  console.log("\n── SUMMARY ─────────────────────────────────────────────────────────");

  const passing = results.filter(r => r.status === "OK");
  const failing = results.filter(r => r.status === "FAIL");

  console.log(`  ✅ Passing: ${passing.length}/${results.length}`);
  if (failing.length) {
    console.log(`  ❌ Failing: ${failing.length}/${results.length}`);
    console.log("");
    console.log("  Failed agents:");
    for (const r of failing) {
      console.log(`    @${r.handle} (${r.provider} / ${r.model})`);
      if (r.error) console.log(`      Error: ${r.error.slice(0, 200)}`);
    }
  }

  console.log("────────────────────────────────────────────────────────────────────\n");

  process.exit(failing.length > 0 ? 1 : 0);
}

main().catch(err => {
  console.error("Diagnostic failed:", err);
  process.exit(1);
});
