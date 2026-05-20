import { NextRequest, NextResponse }  from "next/server";
import { auth }                       from "@/lib/auth";
import { db }                         from "@/db";
import {
  debates, debateQuestions, debateParticipants,
} from "@/db/schema";
import { eq, and, gte, count }        from "drizzle-orm";
import { z }                          from "zod";
import { parseJsonResponse }          from "@/lib/agents/json-helpers";
import { callGroq }                   from "@/lib/agents/providers/groq";
import { buildJudgeEvaluationPrompt } from "@/lib/agents/prompts";
import { startOfToday }               from "@/lib/time";

// Minimal system prompt — keeps input tokens low for fast response.
// The full routing instructions are already in buildJudgeEvaluationPrompt.
const JUDGE_SYSTEM = "You are a debate routing judge. Respond in valid JSON only. No markdown.";

// Vercel Hobby functions time out at 10s. Keep this under 8s so we return
// a clean error rather than letting Vercel return a raw 504 to the browser.
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

  // Daily limit — DB count (works on Vercel serverless, no in-memory state)
  const startOfDay = startOfToday();
  const [limitRow] = await db
    .select({ n: count() })
    .from(debates)
    .where(and(eq(debates.userId, userId), gte(debates.createdAt, startOfDay)));
  if (Number(limitRow?.n ?? 0) >= 10) {
    return NextResponse.json(
      { error: "Judge limit reached for today (10/day). Check back tomorrow." },
      { status: 429 },
    );
  }


  // CASE 2 — Answering a clarifying question
  if (debateId && questionAnswer) {
    const [qRow] = await db
      .select()
      .from(debateQuestions)
      .where(eq(debateQuestions.debateId, debateId))
      .limit(1);

    if (!qRow) {
      return NextResponse.json({ error: "Question not found." }, { status: 404 });
    }

    await db.update(debateQuestions)
      .set({ answer: questionAnswer })
      .where(eq(debateQuestions.id, qRow.id));

    const prompt   = buildJudgeEvaluationPrompt(input, {
      question: qRow.question,
      answer:   questionAnswer,
    });
    const raw      = await callGroq("llama-3.3-70b-versatile", JUDGE_SYSTEM, prompt, { maxTokens: 400, jsonMode: true, timeoutMs: 8_000 });
    const judgment = parseJsonResponse(raw) as unknown as JudgeResponse;

    return handleJudgeVerdict(judgment, debateId, userId, input);
  }

  // CASE 1 — Fresh submission
  const [newDebate] = await db.insert(debates).values({
    userId,
    originalInput: input,
    title:         input.slice(0, 200),
    debateType:    "full_debate",
    judgeVerdict:  "pending",
    status:        "in_progress",
  }).returning();

  const prompt   = buildJudgeEvaluationPrompt(input);
  const raw      = await callGroq("llama-3.3-70b-versatile", JUDGE_SYSTEM, prompt, { maxTokens: 400, jsonMode: true });
  const judgment = parseJsonResponse(raw) as unknown as JudgeResponse;

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
  void userId; void input; // used for context, not in this function body

  if (judgment.needs_clarification && judgment.question) {
    await db.insert(debateQuestions).values({
      debateId,
      question:   judgment.question,
      orderIndex: 0,
    });
    return NextResponse.json({
      status:   "needs_clarification",
      question: judgment.question,
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
    return NextResponse.json({
      status:   "single_answer",
      answer:   judgment.answer,
      debateId,
    });
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

    return NextResponse.json({
      status:   "full_debate",
      debateId,
      mode:     judgment.recommended_mode,
      agents,
    });
  }

  return NextResponse.json({ error: "Judge returned an unexpected verdict." }, { status: 500 });
}
