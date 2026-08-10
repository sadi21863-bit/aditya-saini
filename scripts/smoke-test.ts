/**
 * scripts/smoke-test.ts
 *
 * Quick smoke test against real APIs.
 * Makes two real calls to Groq (gpt-oss-120b and gpt-oss-20b).
 * Both must return text.
 *
 * Run with:  npx tsx scripts/smoke-test.ts
 */

import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(process.cwd(), ".env.local"), override: true });

const GROQ_MODEL_1 = process.env.AGENT_MODEL_ADMIN    ?? "openai/gpt-oss-120b";
const GROQ_MODEL_2 = process.env.AGENT_MODEL_FALLBACK ?? "openai/gpt-oss-20b";

async function runSmoke() {
  const { callGroq } = await import("../lib/agents/providers/groq");

  console.log("=== AI Lab Smoke Test ===\n");

  // ─── Test 1: Groq (admin model) ────────────────────────────────────────
  console.log(`[1/2] Calling Groq with model: ${GROQ_MODEL_1}`);
  const groqStart = Date.now();
  try {
    const groqResult = await callGroq(
      GROQ_MODEL_1,
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

  // ─── Test 2: Groq (fallback model) ─────────────────────────────────────
  console.log(`\n[2/2] Calling Groq with model: ${GROQ_MODEL_2}`);
  const groq2Start = Date.now();
  try {
    const groq2Result = await callGroq(
      GROQ_MODEL_2,
      "You are a test assistant. Reply with exactly one sentence.",
      "Say hello and confirm you are working.",
      { maxTokens: 60, temperature: 0.5 }
    );
    const groq2Ms = Date.now() - groq2Start;
    if (!groq2Result || groq2Result.trim().length === 0) throw new Error("Groq returned empty content");
    console.log(`  ✓ Groq OK (${groq2Ms}ms)`);
    console.log(`  Response: "${groq2Result.slice(0, 200)}"`);
  } catch (err) {
    console.error(`  ✗ Groq FAILED: ${(err as Error).message}`);
    process.exit(1);
  }

  console.log("\n=== Smoke test PASSED — Groq operational ===");
}

runSmoke().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
