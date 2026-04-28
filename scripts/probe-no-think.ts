/**
 * Probe: can Qwen3-32B disable chain-of-thought via /no_think directive?
 * Qwen3-Instruct models support a /no_think flag in the system or user message
 * that disables extended thinking mode, saving tokens we'd discard anyway.
 *
 * Run: npx tsx scripts/probe-no-think.ts
 */
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(process.cwd(), ".env.local"), override: true });

async function probe() {
  const OpenAI = (await import("openai")).default;
  const groq = new OpenAI({
    apiKey:  process.env.GROQ_API_KEY,
    baseURL: "https://api.groq.com/openai/v1",
  });

  const MODEL = process.env.AGENT_MODEL_ADMIN ?? "qwen/qwen3-32b";
  const USER  = 'Say exactly: {"ok": true}';

  async function call(label: string, system: string) {
    process.stdout.write(`\n[${label}]\n  system: ${system.slice(0, 80)}\n  → `);
    try {
      const r = await groq.chat.completions.create({
        model: MODEL, messages: [{ role: "system", content: system }, { role: "user", content: USER }],
        max_tokens: 120, temperature: 0,
      });
      const text = r.choices[0]?.message?.content ?? "(empty)";
      const hasThink = /<think>/i.test(text);
      process.stdout.write(`len=${text.length} has<think>=${hasThink}\n  first 100: ${text.slice(0, 100).replace(/\n/g, "↵")}\n`);
    } catch (e) {
      process.stdout.write(`ERROR: ${(e as Error).message.slice(0, 100)}\n`);
    }
  }

  console.log(`Model: ${MODEL}\n`);

  // Baseline — thinking mode ON (default)
  await call("baseline (thinking ON)", "You output only JSON.");

  // Method 1: /no_think at end of system prompt
  await call("/no_think in system", "You output only JSON. /no_think");

  // Method 2: /no_think as its own system message line
  await call("/no_think as separate line", "You output only JSON.\n/no_think");

  // Method 3: thinking mode disabled via system prompt instruction
  await call("explicit instruction", "You output only JSON. Do not output a thinking block. Do not use <think> tags.");

  console.log("\nDone.");
}

probe().catch(console.error);
