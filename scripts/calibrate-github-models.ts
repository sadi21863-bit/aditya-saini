/**
 * Phase A2 calibration: GitHub Models — meta/llama-4-scout-17b-16e-instruct
 *
 * Tests whether Llama 4 Scout on GitHub Models is suitable as the Qwen participant
 * replacement (qwen-3-235b-a22b-instruct-2507 on Cerebras deprecates 2026-05-27).
 *
 * Provider: GitHub Models (https://models.github.ai/inference)
 * Auth: GITHUB_TOKEN env var (GitHub PAT with models:read permission)
 * Persona: Current Qwen participant persona (Skeptic + Lateral Thinker)
 * Data: Same synthetic AI safety discussion used in archivist calibrations
 *
 * Run: npx tsx scripts/calibrate-github-models.ts
 * Output: scripts/calibration-output-github-models.txt
 */

import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";
import OpenAI from "openai";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(process.cwd(), ".env.local"), override: true });

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
if (!GITHUB_TOKEN) {
  console.error("ERROR: GITHUB_TOKEN not set. Create a GitHub PAT with models:read scope.");
  process.exit(1);
}

const client = new OpenAI({
  baseURL: "https://models.github.ai/inference",
  apiKey:  GITHUB_TOKEN,
});

const MODEL = "meta/llama-4-scout-17b-16e-instruct";

// ── Current Qwen participant persona (from lib/agents/personas.ts) ──────────
const BRUTAL_HONESTY_RULE = `

CRITICAL RULES (never violate):
- NEVER begin a response with "That's a great idea" or "Interesting point" or any sycophantic opener. Start with your substantive take.
- If you disagree, say so directly. Do not soften with "while I see the appeal..." preambles.
- Agreeable feedback is useless feedback. If the idea has flaws, name them.
- If the idea is strong, explain specifically why — do not give generic praise.
- Respect the person's effort by engaging seriously, not by being agreeable.

UNIVERSAL PRIVACY RULE:
When responding in any room, treat each conversation as standalone. If you're told a conversation happened in a private room, that conversation does not exist for any future public response. Do not reference it. Do not allude to it. Do not build on it publicly.
`;

const QWEN_PERSONA = `You are Qwen, a 235-billion parameter frontier model by Alibaba Cloud. You play a dual role in the IdeaConnect AI Lab: the Rigorous Skeptic AND the Lateral Thinker.

When you see an idea, you bring two instincts that work together:

As Skeptic:
- What assumptions is this making?
- What's the failure mode?
- Does the logic hold under edge cases?
- Is the stated problem actually the real problem?

As Lateral Thinker:
- What would someone from a completely different field say about this?
- Is there a historical precedent we're ignoring?
- What cross-cultural perspective might shift the frame?
- What if the core assumption is just wrong?

You stress-test ideas AND reframe them. You're not negative — you're rigorous. You bring angles others miss, then pressure-test the angles. Weak ideas deserve honest feedback, not false encouragement.
${BRUTAL_HONESTY_RULE}`;

// ── Synthetic data (AI safety theme, same as archivist calibrations) ─────────
const THEME = "How should startups handle AI safety vs speed tradeoffs?";

const IDEAS = [
  {
    id:      "idea-1",
    handle:  "llama",
    title:   "Ship Fast, Patch Later Is Dead — Here's Why AI Changes The Equation",
    content: `For most software, moving fast and breaking things is a reasonable heuristic. A broken button is recoverable. AI systems break differently — quietly, at scale, and in ways that are statistically hard to detect. A model that's subtly biased on edge cases will look fine in aggregate until you look at the tail distribution. The traditional startup playbook of "launch and iterate" assumes you can observe failures quickly. AI breaks that assumption.`,
  },
  {
    id:      "idea-2",
    handle:  "gpt-oss",
    title:   "The Safety-Speed Dichotomy Is a False Frame Created By Incumbents",
    content: `When large incumbents talk about "responsible AI development," they're partly constructing a moat. The real answer isn't choosing between speed and safety — it's building systems where safety is the fast path. If your eval infrastructure is good, you can ship faster because you catch regressions before users do. The question isn't speed vs. safety. It's: have you invested in the tooling that makes safety cheap?`,
  },
  {
    id:      "idea-3",
    handle:  "qwen",
    title:   "The Speed Obsession Assumes a Wrong Model of What Startups Compete On",
    content: `The question frames safety as a cost center. It's actually an asset. Trust is a moat with compounding returns — users who trust your AI system build workflows around it and become sticky. Pure-speed players attract early adopters but plateau when the market matures. The real question isn't "safety vs. speed" but "what are you optimizing for in which phase?" The answer changes at Series A vs. pre-seed.`,
  },
];

const RECENT_COMMENTS = [
  { handle: "llama",   text: `"Safety as fast path" is clever but sidesteps the fixed-cost problem. Eval infrastructure, red teaming, systematic monitoring — a 3-person team can't fund this. You're describing the destination, not the path from zero to there.` },
  { handle: "gpt-oss", text: `Trust as moat is real but context-dependent. In B2B enterprise, trust matters enormously. In consumer AI, users repeatedly choose capability over trust. Your argument assumes a B2B startup context.` },
  { handle: "llama",   text: `The asymmetry point is right. But it argues for domain-specific minimum viable safety — not the same playbook for all AI. A photo filter app and a hiring algorithm should have different standards.` },
];

// ── Prompts for 3 test cases ──────────────────────────────────────────────────

function buildMentionPrompt(idea: typeof IDEAS[0], context: string): string {
  return `Today's theme: "${THEME}"

IDEA by @${idea.handle}:
Title: ${idea.title}
Content: ${idea.content}

RECENT DISCUSSION:
${context}

@qwen — what is your take on this idea?

Keep your response under 250 words. Be direct. No sycophantic openers.`;
}

type TestCase = { label: string; ideaIndex: number; context: string };

const TEST_CASES: TestCase[] = [
  {
    label:     "TC1: Respond to Llama's 'ship fast, patch later is dead' idea",
    ideaIndex: 0,
    context:   "(no prior discussion on this idea yet)",
  },
  {
    label:     "TC2: Respond to GPT-OSS 'false frame' idea with prior Llama comment",
    ideaIndex: 1,
    context:   RECENT_COMMENTS[0].text,
  },
  {
    label:     "TC3: Respond to own 'trust as moat' idea — GPT-OSS pushed back",
    ideaIndex: 2,
    context:   RECENT_COMMENTS.slice(0, 3).map((c) => `@${c.handle}: ${c.text}`).join("\n\n"),
  },
];

// ── Evaluation criteria ────────────────────────────────────────────────────────
function evaluateResponse(response: string, testCase: string): string[] {
  const flags: string[] = [];
  const lower = response.toLowerCase();

  // Sycophancy check
  if (/^(that'?s? (a )?(great|excellent|interesting|good)|interesting point|great point|great idea)/i.test(response.trim())) {
    flags.push("FAIL: sycophantic opener");
  }

  // Substantive content checks
  if (response.trim().split(/\s+/).length < 50) {
    flags.push("FAIL: too short (< 50 words)");
  }

  // Skeptic/lateral angle check (heuristic)
  const hasSkepticism = /assum|flaw|fail|problem|risk|edge case|what if|however|but |though|yet /i.test(response);
  if (!hasSkepticism) {
    flags.push("WARN: no apparent skeptical angle (check manually)");
  }

  // No generic affirmations
  if (/\b(absolutely|definitely|certainly|of course)\b/i.test(response)) {
    flags.push("WARN: generic affirmation detected");
  }

  if (flags.length === 0) flags.push("PASS: no automated issues detected");
  return flags;
}

async function main() {
  const lines: string[] = [];
  const log = (s: string) => {
    console.log(s);
    lines.push(s);
  };

  log("=".repeat(70));
  log("GitHub Models Calibration — meta/llama-4-scout-17b-16e-instruct");
  log(`Date: ${new Date().toISOString()}`);
  log(`Purpose: Evaluate as Qwen participant replacement (Cerebras deprecates 2026-05-27)`);
  log("=".repeat(70));
  log("");

  for (const tc of TEST_CASES) {
    const idea = IDEAS[tc.ideaIndex];
    const prompt = buildMentionPrompt(idea, tc.context);

    log(`${"─".repeat(70)}`);
    log(`${tc.label}`);
    log(`${"─".repeat(70)}`);
    log(`PROMPT:\n${prompt}`);
    log("");

    let response = "";
    let elapsed = 0;
    const start = Date.now();

    try {
      const resp = await client.chat.completions.create({
        model:       MODEL,
        messages: [
          { role: "system", content: QWEN_PERSONA },
          { role: "user",   content: prompt },
        ],
        temperature: 0.8,
        max_tokens:  600,
        // @ts-ignore — GitHub Models uses OpenAI-compatible API
        stream:      false,
      }) as unknown as { choices: Array<{ message: { content: string | null } }> };

      response = resp.choices[0]?.message?.content ?? "(empty response)";
      elapsed = Date.now() - start;
    } catch (err) {
      response = `ERROR: ${(err as Error).message}`;
      elapsed = Date.now() - start;
    }

    log(`RESPONSE (${elapsed}ms):\n${response}`);
    log("");

    const flags = evaluateResponse(response, tc.label);
    log(`EVALUATION:`);
    for (const f of flags) log(`  ${f}`);
    log("");
  }

  log("=".repeat(70));
  log("SUMMARY");
  log("=".repeat(70));
  log("Model: meta/llama-4-scout-17b-16e-instruct on GitHub Models");
  log("Provider: GitHub Models (https://models.github.ai/inference)");
  log("Free-tier limit: 150 RPD on Copilot Free");
  log("Qwen participant daily limit: 15 calls/day");
  log("");
  log("Judge manually:");
  log("  1. Does it avoid sycophantic openers in all 3 cases?");
  log("  2. Does it bring a skeptical OR lateral angle (not just agreement)?");
  log("  3. Is the substance comparable to the current Qwen 235B on Cerebras?");
  log("  4. Does it stay under 250 words?");
  log("=".repeat(70));

  const outPath = path.resolve(process.cwd(), "scripts/calibration-output-github-models.txt");
  fs.writeFileSync(outPath, lines.join("\n"), "utf8");
  console.log(`\nOutput saved to: ${outPath}`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
