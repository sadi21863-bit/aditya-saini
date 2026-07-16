/**
 * scripts/verify-groq-json-mode.ts
 *
 * Groq deprecates qwen/qwen3-32b on 2026-07-17. Before swapping model defaults,
 * we need to know which of the candidate replacements actually support
 * response_format: { type: "json_object" } on Groq's native API — the group
 * this codebase depends on for Theme Setter / Quality Checker / participant JSON
 * output. Sends one real request per model with jsonMode on and reports
 * pass/fail with the raw response or error, so JSON_MODE_SUPPORTED in
 * providers/index.ts can be updated from real results instead of assumption.
 */
import "dotenv/config";
import OpenAI from "openai";

const CANDIDATES = ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "qwen/qwen3.6-27b"];

const SYSTEM = "You are a test probe. Respond in JSON only.";
const USER   = `Respond with exactly this JSON object and nothing else: {"ok": true, "note": "json mode test"}`;

function getGroq(): OpenAI {
  return new OpenAI({
    apiKey:  process.env.GROQ_API_KEY ?? "",
    baseURL: "https://api.groq.com/openai/v1",
  });
}

interface Result {
  model:   string;
  status:  "PASS" | "FAIL";
  raw?:    string;
  error?:  string;
  latencyMs: number;
}

async function testModel(client: OpenAI, model: string): Promise<Result> {
  const start = Date.now();
  try {
    const response = await client.chat.completions.create(
      {
        model,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user",   content: USER },
        ],
        max_tokens:  200,
        temperature: 0,
        // @ts-ignore — response_format is valid per Groq's OpenAI-compatible API
        response_format: { type: "json_object" },
      },
      { signal: AbortSignal.timeout(20_000) }
    ) as unknown as { choices: Array<{ message: { content: string | null } }> };

    const raw = response.choices[0]?.message?.content ?? "";
    // Confirm it's actually parseable JSON, not just a 200 with prose.
    JSON.parse(raw.trim());
    return { model, status: "PASS", raw, latencyMs: Date.now() - start };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { model, status: "FAIL", error: msg, latencyMs: Date.now() - start };
  }
}

async function main() {
  console.log("\n🔍 Groq JSON-mode verification (response_format: json_object)\n");
  const client = getGroq();
  const results: Result[] = [];

  for (const model of CANDIDATES) {
    process.stdout.write(`  Testing ${model.padEnd(24)} ... `);
    const result = await testModel(client, model);
    results.push(result);
    if (result.status === "PASS") {
      console.log(`✅ PASS (${result.latencyMs}ms) — ${result.raw}`);
    } else {
      console.log(`❌ FAIL (${result.latencyMs}ms) — ${result.error?.slice(0, 200)}`);
    }
  }

  console.log("\n── SUMMARY ─────────────────────────────────────────────────────────");
  for (const r of results) {
    console.log(`  ${r.status === "PASS" ? "✅" : "❌"} ${r.model}`);
  }
  console.log("────────────────────────────────────────────────────────────────────\n");

  process.exit(results.some(r => r.status === "FAIL") ? 0 : 0);
}

main().catch(err => {
  console.error("verify-groq-json-mode failed:", err);
  process.exit(1);
});
