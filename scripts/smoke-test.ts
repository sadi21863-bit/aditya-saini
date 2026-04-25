/**
 * scripts/smoke-test.ts
 *
 * Step 9: Quick smoke test against real APIs.
 * Makes one real call to Groq (qwen/qwen3-32b) and one real call to
 * Cerebras (qwen-3-235b-a22b-instruct-2507). Both must return text.
 *
 * Dynamic imports inside the async main ensure dotenv runs BEFORE the
 * OpenAI client modules initialise (they read API keys at module load time).
 *
 * Run with:  npx tsx scripts/smoke-test.ts
 */

import * as dotenv from "dotenv";
import * as path from "path";

// Load env vars before any openai-dependent module is imported
dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(process.cwd(), ".env.local"), override: true });

const GROQ_MODEL     = process.env.AGENT_MODEL_ADMIN    ?? "qwen/qwen3-32b";
const CEREBRAS_MODEL = process.env.AGENT_MODEL_ARCHIVIST ?? "qwen-3-235b-a22b-instruct-2507";

async function runSmoke() {
  // Dynamic imports so provider modules initialise AFTER env vars are loaded
  const { callGroq }     = await import("../lib/agents/providers/groq");
  const { callCerebras } = await import("../lib/agents/providers/cerebras");

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
    if (!groqResult || groqResult.trim().length === 0) {
      throw new Error("Groq returned empty content");
    }
    console.log(`  ✓ Groq OK (${groqMs}ms)`);
    console.log(`  Response: "${groqResult.slice(0, 200)}"`);
  } catch (err) {
    console.error(`  ✗ Groq FAILED: ${(err as Error).message}`);
    process.exit(1);
  }

  // ─── Test 2: Cerebras ────────────────────────────────────────────────
  console.log(`\n[2/2] Calling Cerebras with model: ${CEREBRAS_MODEL}`);
  const cerebrasStart = Date.now();
  try {
    const cerebrasResult = await callCerebras(
      CEREBRAS_MODEL,
      "You are a test assistant. Reply with exactly one sentence.",
      "Say hello and confirm you are working.",
      { maxTokens: 60, temperature: 0.5 }
    );
    const cerebrasMs = Date.now() - cerebrasStart;
    if (!cerebrasResult || cerebrasResult.trim().length === 0) {
      throw new Error("Cerebras returned empty content");
    }
    console.log(`  ✓ Cerebras OK (${cerebrasMs}ms)`);
    console.log(`  Response: "${cerebrasResult.slice(0, 200)}"`);
  } catch (err) {
    console.error(`  ✗ Cerebras FAILED: ${(err as Error).message}`);
    process.exit(1);
  }

  console.log("\n=== Smoke test PASSED — both providers operational ===");
}

runSmoke().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
