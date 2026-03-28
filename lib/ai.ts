import Groq from "groq-sdk";

// ─────────────────────────────────────────────────────────────────────────────
// Groq AI client — IdeaConnect v12
// Model: llama-3.1-8b-instant
// Used only for Vault idea analysis, opt-in, owner-only
// ─────────────────────────────────────────────────────────────────────────────

// Lazily instantiate so missing key fails at call-time, not module load
let _groq: Groq | null = null;

function getClient(): Groq {
  if (!_groq) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error("GROQ_API_KEY environment variable is not set");
    }
    _groq = new Groq({ apiKey });
  }
  return _groq;
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface AnalyzeIdeaInput {
  title: string;
  description: string;         // full content / body of the idea
  classification?: string;     // category
  tags?: string[];
}

export interface AIAnalysisResult {
  feasibility: number;         // 0–100
  clarity: number;             // 0–100
  marketPotential: number;     // 0–100
  score: number;               // 0–100 weighted overall
  summary: string;             // 2–4 sentence narrative
}

// ── Prompt builder ───────────────────────────────────────────────────────────

function buildPrompt(input: AnalyzeIdeaInput): string {
  const tagLine =
    input.tags && input.tags.length > 0
      ? `Tags: ${input.tags.join(", ")}`
      : "";
  const classLine = input.classification
    ? `Category: ${input.classification}`
    : "";

  return `You are an expert innovation analyst reviewing a privately-submitted idea from a Genesis Vault platform.

Analyse the following idea and respond ONLY with a valid JSON object — no markdown fences, no explanation, no preamble.

IDEA TITLE: ${input.title}
${classLine}
${tagLine}
IDEA DESCRIPTION:
${input.description}

Return exactly this JSON shape:
{
  "feasibility": 75,
  "clarity": 80,
  "marketPotential": 70,
  "score": 75,
  "summary": "2–4 sentence narrative summary of the idea's strengths, weaknesses, and potential."
}

Rules:
- feasibility: integer 0–100 (how realistic is this to build/execute?)
- clarity: integer 0–100 (how well-explained and structured is the idea?)
- marketPotential: integer 0–100 (how strong is the commercial or social opportunity?)
- score: integer 0–100, weighted average: (feasibility * 0.35 + clarity * 0.25 + marketPotential * 0.40)
- summary: plain English, 2–4 sentences, no bullet points
- Respond with ONLY the JSON object. Nothing else.`;
}

// ── Parse and validate response ───────────────────────────────────────────────

function parseResponse(raw: string): AIAnalysisResult {
  // Strip any accidental markdown fences
  const cleaned = raw
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`Groq returned non-JSON response: ${raw.slice(0, 200)}`);
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    typeof (parsed as Record<string, unknown>).feasibility !== "number" ||
    typeof (parsed as Record<string, unknown>).clarity !== "number" ||
    typeof (parsed as Record<string, unknown>).marketPotential !== "number" ||
    typeof (parsed as Record<string, unknown>).score !== "number" ||
    typeof (parsed as Record<string, unknown>).summary !== "string"
  ) {
    throw new Error("Groq response missing required fields");
  }

  const obj = parsed as Record<string, unknown>;
  return {
    feasibility:     Math.min(100, Math.max(0, Math.round(obj.feasibility as number))),
    clarity:         Math.min(100, Math.max(0, Math.round(obj.clarity as number))),
    marketPotential: Math.min(100, Math.max(0, Math.round(obj.marketPotential as number))),
    score:           Math.min(100, Math.max(0, Math.round(obj.score as number))),
    summary:         String(obj.summary).slice(0, 1000),
  };
}

// ── Main exported function ────────────────────────────────────────────────────

/**
 * Analyse a Vault idea using Groq llama-3.1-8b-instant.
 *
 * Throws on any error — caller must handle:
 *   - Groq.APIError with status 429 → rate limited, add to queue
 *   - Any other error → mark as failed
 *
 * Caching is handled by the caller: if ideas.aiSummary is already set,
 * this function is never called.
 */
export async function analyzeIdea(
  input: AnalyzeIdeaInput
): Promise<AIAnalysisResult> {
  const client = getClient();
  const prompt = buildPrompt(input);

  const completion = await client.chat.completions.create({
    model: "llama-3.1-8b-instant",
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
    max_tokens: 512,
    temperature: 0.2,
    stream: false,
  });

  const rawText = completion.choices[0]?.message?.content ?? "";
  if (!rawText) {
    throw new Error("Groq returned an empty response");
  }

  return parseResponse(rawText);
}
