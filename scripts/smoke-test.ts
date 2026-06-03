/**
 * scripts/smoke-test.ts
 *
 * Quick smoke test against real APIs.
 * Makes one real call to Groq (qwen/qwen3-32b) and one to GitHub Models (gpt-4o-mini).
 * Both must return text.
 *
 * Run with:  npx tsx scripts/smoke-test.ts
 */

import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(process.cwd(), ".env.local"), override: true });

const GROQ_MODEL   = process.env.AGENT_MODEL_ADMIN    ?? "qwen/qwen3-32b";
const GITHUB_MODEL = process.env.AGENT_MODEL_RESEARCH ?? "openai/gpt-4o-mini";

async function runSmoke() {
  const { callGroq }   = await import("../lib/agents/providers/groq");
  const { callGitHub } = await import("../lib/agents/providers/github");

  console.log("=== AI Lab Smoke Test ===\n");

  // ─── Test 1: Groq ────────────────────────────────────────────────────
  console.log(`[1/2] Calling Groq with model: ${GROQ_MODEL}`);
  const groqStart = Date.now();
  try {
    const groqResult = await callGroq(
      GROQ_MODEL,
      "You are a test assistant. Reply with exactly one sentence.",
      "Say hello and confirm you are working.",
      { maxTokens: 60, temperature: 0.5 }
    );
    const groqMs = Date.now() - groqStart;
    if (!groqResult || groqResult.trim().length === 0) throw new Error("Groq returned empty content");
    console.log(`  ✓ Groq OK (${groqMs}ms)`);
    console.log(`  Response: "${groqResult.slice(0, 200)}"`);
  } catch (err) {
    console.error(`  ✗ Groq FAILED: ${(err as Error).message}`);
    process.exit(1);
  }

  // ─── Test 2: GitHub Models ────────────────────────────────────────────
  console.log(`\n[2/2] Calling GitHub Models with model: ${GITHUB_MODEL}`);
  const ghStart = Date.now();
  try {
    const ghResult = await callGitHub(
      GITHUB_MODEL,
      "You are a test assistant. Reply with exactly one sentence.",
      "Say hello and confirm you are working.",
      { maxTokens: 60, temperature: 0.5 }
    );
    const ghMs = Date.now() - ghStart;
    if (!ghResult || ghResult.trim().length === 0) throw new Error("GitHub Models returned empty content");
    console.log(`  ✓ GitHub Models OK (${ghMs}ms)`);
    console.log(`  Response: "${ghResult.slice(0, 200)}"`);
  } catch (err) {
    console.error(`  ✗ GitHub Models FAILED: ${(err as Error).message}`);
    process.exit(1);
  }

  console.log("\n=== Smoke test PASSED — both providers operational ===");
}

runSmoke().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
