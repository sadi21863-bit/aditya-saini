import { NextRequest, NextResponse }  from "next/server";
import { auth }                       from "@/lib/auth";
import { db }                         from "@/db";
import {
  debates, debateQuestions, debateParticipants, aiUsage,
} from "@/db/schema";
import { and, count, eq, gte }        from "drizzle-orm";
import { z }                          from "zod";
import { parseJsonResponse }          from "@/lib/agents/json-helpers";
import { callGroq }                   from "@/lib/agents/providers/groq";
import { buildJudgeEvaluationPrompt } from "@/lib/agents/prompts";

const QUICK_DEBATE_HOURLY_LIMIT = 3;
const QUICK_DEBATE_DAILY_CAP    = parseInt(process.env.QUICK_DEBATE_DAILY_CAP ?? "150");

// 10-word system prompt — full instructions are inside buildJudgeEvaluationPrompt.
const JUDGE_SYSTEM = "You are a debate routing judge. Respond in valid JSON only. No markdown.";

// Vercel Hobby hard limit is 10s. Declare it explicitly so it's visible.
export const maxDuration = 10;

const BodySchema = z.object({
  input:          z.string().min(10).max(2000),
  debateId:       z.string().uuid().optional(),
  questionAnswer: z.string().max(500).optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in to use Quick Debate." }, { status: 401 });
  }
  const userId = session.user.id;

  const body   = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 },
    );
  }
  const { input, debateId, questionAnswer } = parsed.data;

  // ── CASE 2: user answering a clarifying question ─────────────────────────
  // Re-routing only — the debate already exists. Skip IP rate limit.
  if (debateId && questionAnswer) {
    const questionText = body.questionText as string | undefined;
    const prompt  = buildJudgeEvaluationPrompt(input, {
      question: questionText ?? "Please clarify your idea.",
      answer:   questionAnswer,
    });
    const raw     = await callGroq(
      process.env.AGENT_MODEL_LLAMA ?? "llama-3.3-70b-versatile", JUDGE_SYSTEM, prompt,
      { maxTokens: 400, jsonMode: true, timeoutMs: 8_000 },
    );
    const judgment = parseJsonResponse(raw) as unknown as JudgeResponse;

    await db.update(debateQuestions)
      .set({ answer: questionAnswer })
      .where(eq(debateQuestions.debateId, debateId));

    return handleJudgeVerdict(judgment, debateId, userId, input);
  }

  // ── CASE 1: fresh submission — IP rate limiting ───────────────────────────
  const clientIp   = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const startOfDayUTC = new Date(new Date().setUTCHours(0, 0, 0, 0));

  const [[hourlyRow], [dailyRow]] = await Promise.all([
    db.select({ n: count() }).from(aiUsage).where(
      and(
        eq(aiUsage.ipAddress, clientIp),
        eq(aiUsage.feature, "quick_debate"),
        gte(aiUsage.createdAt, oneHourAgo),
      ),
    ),
    db.select({ n: count() }).from(aiUsage).where(
      and(
        eq(aiUsage.feature, "quick_debate"),
        gte(aiUsage.createdAt, startOfDayUTC),
      ),
    ),
  ]);

  if (Number(hourlyRow?.n ?? 0) >= QUICK_DEBATE_HOURLY_LIMIT) {
    return NextResponse.json(
      { error: "You can start 3 debates per hour. Try again shortly." },
      { status: 429 },
    );
  }

  if (Number(dailyRow?.n ?? 0) >= QUICK_DEBATE_DAILY_CAP) {
    const resetAt = new Date(startOfDayUTC.getTime() + 24 * 60 * 60 * 1000).toISOString();
    return NextResponse.json(
      {
        error:   "The Debate Arena has reached its daily capacity. It resets at midnight UTC.",
        resetAt,
      },
      { status: 429 },
    );
  }

  // ── LLM call — no DB before this ─────────────────────────────────────────
  const prompt   = buildJudgeEvaluationPrompt(input);
  const raw      = await callGroq(
    process.env.AGENT_MODEL_LLAMA ?? "llama-3.3-70b-versatile", JUDGE_SYSTEM, prompt,
    { maxTokens: 400, jsonMode: true, timeoutMs: 8_000 },
  );
  const judgment = parseJsonResponse(raw) as unknown as JudgeResponse;

  const [newDebate] = await db.insert(debates).values({
    userId,
    originalInput: input,
    title:         input.slice(0, 200),
    debateType:    "full_debate",
    judgeVerdict:  "pending",
    status:        "in_progress",
  }).returning();

  // Write rate limit tracking row after debate creation
  await db.insert(aiUsage).values({
    ipAddress: clientIp,
    feature:   "quick_debate",
    tokens:    0,
  });

  return handleJudgeVerdict(judgment, newDebate.id, userId, input);
}

interface JudgeResponse {
  needs_clarification: boolean;
  question:            string | null;
  verdict:             "single_answer" | "full_debate" | null;
  reasoning:           string | null;
  answer:              string | null;
  recommended_agents:  string[] | null;
  recommended_mode:    string | null;
}

async function handleJudgeVerdict(
  judgment: JudgeResponse,
  debateId: string,
  userId:   string,
  input:    string,
): Promise<NextResponse> {
  void userId; void input;

  if (judgment.needs_clarification && judgment.question) {
    await db.insert(debateQuestions).values({
      debateId,
      question:   judgment.question,
      orderIndex: 0,
    });
    return NextResponse.json({
      status:       "needs_clarification",
      question:     judgment.question,
      questionText: judgment.question,
      debateId,
    });
  }

  if (judgment.verdict === "single_answer") {
    await db.update(debates)
      .set({
        debateType:   "quick_take",
        judgeVerdict: "single_answer",
        judgeAnswer:  judgment.answer ?? "",
        status:       "archived",
        archivedAt:   new Date(),
        updatedAt:    new Date(),
      })
      .where(eq(debates.id, debateId));
    return NextResponse.json({ status: "single_answer", answer: judgment.answer, debateId });
  }

  if (judgment.verdict === "full_debate") {
    const agents = judgment.recommended_agents ?? ["ai_llama", "ai_maverick"];
    await db.update(debates)
      .set({
        judgeVerdict:   "full_debate",
        judgeReasoning: judgment.reasoning ?? "",
        debateMode:     judgment.recommended_mode ?? "brainstorm",
        updatedAt:      new Date(),
      })
      .where(eq(debates.id, debateId));

    await db.insert(debateParticipants).values([
      { debateId, agentId: agents[0], slotIndex: 0 },
      { debateId, agentId: agents[1], slotIndex: 1 },
    ]);

    return NextResponse.json({ status: "full_debate", debateId, mode: judgment.recommended_mode, agents });
  }

  return NextResponse.json({ error: "Judge returned an unexpected verdict." }, { status: 500 });
}
