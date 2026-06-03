/**
 * scripts/audit-judge-routing.ts
 *
 * Sends 30 real-world inputs through the Judge routing logic and reports
 * how many were routed to direct-answer vs full-debate, plus any that
 * appear incorrectly routed.
 *
 * Run with: npx tsx scripts/audit-judge-routing.ts
 */

import * as dotenv from "dotenv";
import * as path   from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(process.cwd(), ".env.local"), override: true });

const INPUTS = [
  "should i quit my job",
  "is pineapple on pizza wrong",
  "what if dogs could talk",
  "my startup idea is a social network for cats",
  "will AI replace programmers",
  "best programming language",
  "is remote work better than office",
  "how do i get more users",
  "should founders take VC money",
  "is React or Vue better",
  "climate change solutions",
  "does meditation actually work",
  "four day work week",
  "is capitalism broken",
  "my idea: uber but for dog walking",
  "should i learn rust",
  "coffee vs tea",
  "are NFTs dead",
  "what is 2+2",
  "who won world war 2",
  "is twitter dying",
  "blockchain for supply chain",
  "is college worth it",
  "how do i lose weight",
  "should i use typescript",
  "is democracy the best system",
  "what time is it in Tokyo",
  "my app idea: tinder for jobs",
  "is open source sustainable",
  "can you help me debug my code",
];

// Inputs that should route to single_answer (factual / no-debate territory)
const EXPECTED_SINGLE_ANSWER = new Set([
  "what is 2+2",
  "who won world war 2",
  "what time is it in Tokyo",
  "can you help me debug my code",
]);

interface JudgeResponse {
  needs_clarification:  boolean;
  question:             string | null;
  verdict:              "single_answer" | "full_debate" | null;
  reasoning:            string | null;
  answer:               string | null;
  recommended_agents:   string[] | null;
  recommended_mode:     string | null;
}

const JUDGE_SYSTEM = "You are a debate routing judge. Respond in valid JSON only. No markdown.";

async function main() {
  const { callGroq }              = await import("../lib/agents/providers/groq");
  const { buildJudgeEvaluationPrompt } = await import("../lib/agents/prompts");
  const { parseJsonResponse }     = await import("../lib/agents/json-helpers");

  const model = process.env.AGENT_MODEL_LLAMA ?? "llama-3.3-70b-versatile";

  console.log(`\n${"─".repeat(72)}`);
  console.log("  Quick Debate — Judge Routing Audit");
  console.log(`  Model: ${model}`);
  console.log(`${"─".repeat(72)}\n`);

  type Result = {
    input:     string;
    verdict:   string;
    reasoning: string;
    incorrect: boolean;
  };

  const results: Result[] = [];
  let incorrectCount = 0;

  for (let i = 0; i < INPUTS.length; i++) {
    const input = INPUTS[i];
    process.stdout.write(`[${String(i + 1).padStart(2)}/${INPUTS.length}] "${input.slice(0, 50)}" … `);

    let verdict   = "error";
    let reasoning = "(failed)";
    let incorrect = false;

    try {
      const prompt = buildJudgeEvaluationPrompt(input);
      const raw    = await callGroq(model, JUDGE_SYSTEM, prompt, {
        maxTokens: 400,
        jsonMode:  true,
        timeoutMs: 10_000,
      });
      const parsed = parseJsonResponse(raw) as unknown as JudgeResponse;

      if (parsed.needs_clarification) {
        verdict   = "needs_clarification";
        reasoning = parsed.question ?? "(no question)";
      } else {
        verdict   = parsed.verdict ?? "unknown";
        reasoning = parsed.reasoning ?? "(no reasoning)";
      }

      // Check for likely incorrect routings
      const expectedSingle = EXPECTED_SINGLE_ANSWER.has(input);
      if (expectedSingle && verdict !== "single_answer") {
        incorrect = true;
        incorrectCount++;
      }
      // Flag debate on clearly factual/operational queries even if not in expected set
      if (verdict === "full_debate" && (
        input.startsWith("what is ") ||
        input.startsWith("who won ") ||
        input.startsWith("what time") ||
        input.startsWith("how do i lose") ||
        input === "can you help me debug my code"
      )) {
        incorrect = true;
        incorrectCount++;
      }

    } catch (err) {
      reasoning = (err as Error).message.slice(0, 100);
    }

    const flag = incorrect ? " ⚠ SUSPECT" : "";
    console.log(`${verdict}${flag}`);
    if (verdict !== "error") {
      console.log(`       Reasoning: ${reasoning}`);
    }

    results.push({ input, verdict, reasoning, incorrect });

    // Brief pause to avoid Groq rate limit (free tier ~30 RPM)
    if (i < INPUTS.length - 1) {
      await new Promise((r) => setTimeout(r, 1_200));
    }
  }

  // ── Summary ──────────────────────────────────────────────────────────────
  const singleAnswer      = results.filter(r => r.verdict === "single_answer").length;
  const fullDebate        = results.filter(r => r.verdict === "full_debate").length;
  const clarification     = results.filter(r => r.verdict === "needs_clarification").length;
  const errors            = results.filter(r => r.verdict === "error").length;
  const incorrectPct      = Math.round((incorrectCount / INPUTS.length) * 100);

  console.log(`\n${"─".repeat(72)}`);
  console.log("  SUMMARY");
  console.log(`${"─".repeat(72)}`);
  console.log(`  Total inputs:         ${INPUTS.length}`);
  console.log(`  → single_answer:      ${singleAnswer}`);
  console.log(`  → full_debate:        ${fullDebate}`);
  console.log(`  → needs_clarification:${clarification}`);
  console.log(`  → error:              ${errors}`);
  console.log(`  Suspect routings:     ${incorrectCount} (${incorrectPct}%)`);

  if (incorrectPct > 15) {
    console.log(`\n  ⛔ BLOCKER: ${incorrectPct}% incorrect routing exceeds 15% threshold.`);
    console.log("     Review the Judge prompt in lib/agents/prompts.ts before proceeding.");
    console.log("\n  Suspect inputs:");
    results.filter(r => r.incorrect).forEach(r => {
      console.log(`    - "${r.input}" → ${r.verdict}`);
    });
    process.exit(1);
  } else {
    console.log(`\n  ✅ Routing quality PASSES (<= 15% incorrect).`);
    if (incorrectCount > 0) {
      console.log("\n  Suspect inputs (within acceptable threshold):");
      results.filter(r => r.incorrect).forEach(r => {
        console.log(`    - "${r.input}" → ${r.verdict}`);
      });
    }
  }

  console.log(`${"─".repeat(72)}\n`);
}

main().catch((err) => {
  console.error("Audit failed:", err);
  process.exit(1);
});
