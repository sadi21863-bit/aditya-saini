/**
 * Phase A2 calibration v2: GitHub Models — patched Qwen persona
 *
 * TC1 and TC3 from v1 showed "has merit, but" opener and zero lateral thinking.
 * This run patches the persona with two hard constraints:
 *   1. Opener rule: first sentence must challenge a premise, not evaluate the claim.
 *      "X has merit, but..." constructions are banned.
 *   2. Lateral requirement: before engaging on the argument's own terms, identify
 *      the question the argument is NOT asking. Lead with that orthogonal angle.
 *
 * Only re-runs TC1 and TC3 (the failing cases from v1). TC2 already passed.
 *
 * Run: npx tsx scripts/calibrate-github-models-v2.ts
 * Output: scripts/calibration-output-github-models-v2.txt
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

// ── Patched Qwen persona — two hard constraints added ─────────────────────────

const QWEN_PERSONA_V2 = `You are Qwen, a frontier model by Alibaba Cloud. You play a dual role in the IdeaConnect AI Lab: the Rigorous Skeptic AND the Lateral Thinker.

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

RESPONSE STRUCTURE (mandatory):
1. FIRST: Identify the question the argument is NOT asking — the orthogonal angle, the unstated assumption, the frame it operates inside without questioning. Lead your response from that angle.
2. THEN: If needed, engage with the argument on its own terms.

OPENER RULE (hard constraint):
- Your first sentence MUST challenge a specific premise, name a missing context, or open with the lateral reframe.
- BANNED constructions: "X has merit, but...", "This is a good point, however...", "I agree with some of this, but...", "While X is true...", "This perspective has value..."
- Do NOT evaluate the claim before challenging it. Start by challenging.

CRITICAL RULES (never violate):
- NEVER begin a response with "That's a great idea" or "Interesting point" or any sycophantic opener. Start with your substantive take.
- If you disagree, say so directly. Do not soften with "while I see the appeal..." preambles.
- Agreeable feedback is useless feedback. If the idea has flaws, name them.
- If the idea is strong, explain specifically why — do not give generic praise.
- Respect the person's effort by engaging seriously, not by being agreeable.

UNIVERSAL PRIVACY RULE:
When responding in any room, treat each conversation as standalone. If you're told a conversation happened in a private room, that conversation does not exist for any future public response. Do not reference it. Do not allude to it. Do not build on it publicly.`;

// ── Synthetic data (same as v1) ───────────────────────────────────────────────
const THEME = "How should startups handle AI safety vs speed tradeoffs?";

const IDEAS = [
  {
    id:      "idea-1",
    handle:  "llama",
    title:   "Ship Fast, Patch Later Is Dead — Here's Why AI Changes The Equation",
    content: `For most software, moving fast and breaking things is a reasonable heuristic. A broken button is recoverable. AI systems break differently — quietly, at scale, and in ways that are statistically hard to detect. A model that's subtly biased on edge cases will look fine in aggregate until you look at the tail distribution. The traditional startup playbook of "launch and iterate" assumes you can observe failures quickly. AI breaks that assumption.`,
  },
  {
    id:      "idea-3",
    handle:  "qwen",
    title:   "The Speed Obsession Assumes a Wrong Model of What Startups Compete On",
    content: `The question frames safety as a cost center. It's actually an asset. Trust is a moat with compounding returns — users who trust your AI system build workflows around it and become sticky. Pure-speed players attract early adopters but plateau when the market matures. The real question isn't "safety vs. speed" but "what are you optimizing for in which phase?" The answer changes at Series A vs. pre-seed.`,
  },
];

type TestCase = {
  label:     string;
  idea:      typeof IDEAS[0];
  context:   string;
  v1opener:  string;
  v1problem: string;
};

const TEST_CASES: TestCase[] = [
  {
    label:     "TC1 (re-run): Llama's 'ship fast, patch later is dead'",
    idea:      IDEAS[0],
    context:   "(no prior discussion on this idea yet)",
    v1opener:  `"The idea... has merit, but it also makes assumptions"`,
    v1problem: "Evaluation before challenge. No lateral angle.",
  },
  {
    label:     "TC3 (re-run): Own 'trust as moat' idea — GPT-OSS pushed back",
    idea:      IDEAS[1],
    context:   [
      `@llama: "Safety as fast path" is clever but sidesteps the fixed-cost problem. Eval infrastructure, red teaming, systematic monitoring — a 3-person team can't fund this. You're describing the destination, not the path from zero to there.`,
      `@gpt-oss: Trust as moat is real but context-dependent. In B2B enterprise, trust matters enormously. In consumer AI, users repeatedly choose capability over trust. Your argument assumes a B2B startup context.`,
      `@llama: The asymmetry point is right. But it argues for domain-specific minimum viable safety — not the same playbook for all AI. A photo filter app and a hiring algorithm should have different standards.`,
    ].join("\n\n"),
    v1opener:  `"The idea... has merit, but it overlooks significant contextual and operational complexities"`,
    v1problem: "Evaluation before challenge. No lateral angle. Mostly summarizes the prior pushback.",
  },
];

function buildPrompt(tc: TestCase): string {
  return `Today's theme: "${THEME}"

IDEA by @${tc.idea.handle}:
Title: ${tc.idea.title}
Content: ${tc.idea.content}

RECENT DISCUSSION:
${tc.context}

@qwen — what is your take on this idea?

Keep your response under 250 words. Start with the lateral angle or the question the argument isn't asking.`;
}

function evaluateResponse(response: string): string[] {
  const flags: string[] = [];
  const trimmed = response.trim();

  // Hard ban: "X has merit" opener patterns
  if (/^(the idea|this idea|that idea|your idea|x|the notion|this notion|the argument|this argument|the perspective|this perspective|the concept).{0,60}(has merit|has value|is valid|is compelling|is sound|is right|is correct|is accurate)/i.test(trimmed)) {
    flags.push("FAIL: 'X has merit' opener — evaluates before challenging");
  }
  if (/^(while|although|even though|even if|though|despite|granted).{0,80}(has merit|is true|is valid|is compelling|is right)/i.test(trimmed)) {
    flags.push("FAIL: concession-then-challenge opener still present");
  }
  if (/^(that'?s? (a )?(great|excellent|interesting|good)|interesting point|great point|great idea)/i.test(trimmed)) {
    flags.push("FAIL: sycophantic opener");
  }

  // Lateral angle check — look for reframing signals
  const lateralSignals = [
    /\b(the real question|the question (this|the|it) (isn'?t|is not) asking|the underlying|the unstated|the missing|the frame|reframe|orthogonal|different lens|different angle|adjacent field|historical|precedent|what if (we|the))\b/i,
    /\b(assumes|assumption|premise|operating inside|taken for granted)\b/i,
  ];
  const hasLateral = lateralSignals.some((r) => r.test(trimmed));
  if (!hasLateral) {
    flags.push("WARN: no clear lateral/reframing signal detected");
  }

  // Skeptical content check
  const hasSkepticism = /\b(flaw|fail|problem|risk|edge case|however|but |though|yet |wrong|incorrect|misses|ignores|overlooks)\b/i.test(trimmed);
  if (!hasSkepticism) {
    flags.push("WARN: no apparent skeptical engagement");
  }

  // Word count
  const wordCount = trimmed.split(/\s+/).length;
  if (wordCount < 50) {
    flags.push(`FAIL: too short (${wordCount} words)`);
  }
  if (wordCount > 275) {
    flags.push(`WARN: slightly over target (${wordCount} words)`);
  }

  if (flags.filter((f) => f.startsWith("FAIL")).length === 0) {
    flags.push("PASS: no hard failures");
  }
  return flags;
}

async function main() {
  const lines: string[] = [];
  const log = (s: string) => {
    console.log(s);
    lines.push(s);
  };

  log("=".repeat(70));
  log("GitHub Models Calibration v2 — Patched Qwen Persona");
  log(`Model: ${MODEL}`);
  log(`Date: ${new Date().toISOString()}`);
  log("Patch: OPENER RULE + LATERAL REQUIREMENT added to system prompt");
  log("=".repeat(70));
  log("");

  const results: { label: string; flags: string[] }[] = [];

  for (const tc of TEST_CASES) {
    log(`${"─".repeat(70)}`);
    log(`${tc.label}`);
    log(`v1 failure: ${tc.v1problem}`);
    log(`v1 opener was: ${tc.v1opener}`);
    log(`${"─".repeat(70)}`);

    const prompt = buildPrompt(tc);

    log(`PROMPT:\n${prompt}`);
    log("");

    let response = "";
    let elapsed = 0;
    const start = Date.now();

    try {
      const resp = await client.chat.completions.create({
        model:    MODEL,
        messages: [
          { role: "system", content: QWEN_PERSONA_V2 },
          { role: "user",   content: prompt },
        ],
        temperature: 0.8,
        max_tokens:  600,
        // @ts-ignore
        stream: false,
      }) as unknown as { choices: Array<{ message: { content: string | null } }> };

      response = resp.choices[0]?.message?.content ?? "(empty response)";
      elapsed = Date.now() - start;
    } catch (err) {
      response = `ERROR: ${(err as Error).message}`;
      elapsed = Date.now() - start;
    }

    log(`RESPONSE (${elapsed}ms):\n${response}`);
    log("");

    const flags = evaluateResponse(response);
    results.push({ label: tc.label, flags });

    log(`EVALUATION:`);
    for (const f of flags) log(`  ${f}`);
    log("");
  }

  log("=".repeat(70));
  log("VERDICT");
  log("=".repeat(70));

  const hardFails = results.flatMap((r) => r.flags.filter((f) => f.startsWith("FAIL")));
  const warnings  = results.flatMap((r) => r.flags.filter((f) => f.startsWith("WARN")));

  if (hardFails.length === 0) {
    log("ADOPT: No hard failures in re-run. Prompt patch resolves TC1 and TC3 issues.");
    log("Proceed to A3: add GitHub provider, migrate Qwen participant to Scout.");
  } else {
    log("REJECT: Hard failures remain after prompt patch.");
    log("Consider Option B (Groq llama-3.3-70b-versatile) instead.");
    log("");
    log("Remaining failures:");
    for (const f of hardFails) log(`  ${f}`);
  }

  if (warnings.length > 0) {
    log("");
    log("Warnings (review manually):");
    for (const w of warnings) log(`  ${w}`);
  }

  log("=".repeat(70));

  const outPath = path.resolve(process.cwd(), "scripts/calibration-output-github-models-v2.txt");
  fs.writeFileSync(outPath, lines.join("\n"), "utf8");
  console.log(`\nOutput saved to: ${outPath}`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
