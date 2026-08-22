/**
 * scripts/backfill-archives.ts
 *
 * Backfills missing daily archives (Jul 9 – Aug 9), then generates
 * weekly and monthly rollups. Uses the same two-pass approach as
 * executeArchiveDay + the rollup handlers.
 *
 * Usage: npx tsx scripts/backfill-archives.ts [--dry-run] [--skip-archives] [--start YYYY-MM-DD] [--end YYYY-MM-DD]
 */
import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local" });
import { db } from "../db";
import {
  aiThemes, ideas, ideaComments, searchCache,
  aiLabArchives, aiLabRollups, aiUsage, users,
} from "../db/schema";
import { and, asc, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { callGroq } from "../lib/agents/providers/groq";
import { buildIdeaSummaryPrompt, buildRollupWeekPrompt, buildRollupMonthPrompt } from "../lib/agents/prompts";
import { stripThinkingTags } from "../lib/agents/response-cleaner";
import { parseJsonResponse } from "../lib/agents/json-helpers";
import { formatResearchBlock, type SourceCitation } from "../lib/agents/research";

const DRY_RUN   = process.argv.includes("--dry-run");
const SKIP_ARCH = process.argv.includes("--skip-archives");
const START_ARG = process.argv.find((a, i) => process.argv[i - 1] === "--start");
const END_ARG   = process.argv.find((a, i) => process.argv[i - 1] === "--end");

const RANGE_START = START_ARG ?? "2026-07-09";
const RANGE_END   = END_ARG   ?? "2026-08-09";

const ARCHIVIST_MODEL = "llama-3.3-70b-versatile";
const SUMMARIZER_MODEL = "llama-3.3-70b-versatile";

interface IdeaSummary {
  title: string;
  summary: string;
  quotes: Array<{ agent: string; text: string; context: string }>;
}

interface ArchiveParsed {
  theme: string;
  narrative_arc: string;
  key_disagreements: Array<{ between: string[]; topic: string; resolution: string }>;
  key_questions: string[];
  memorable_quotes: Array<{ agent: string; text: string; context: string }>;
  stats: { ideas_count: number; comments_count: number; participants_active: number; longest_thread_idea_id: string };
  strongest_voice_agent_handle?: string | null;
}

function dateRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const d = new Date(start + "T00:00:00Z");
  const e = new Date(end + "T00:00:00Z");
  while (d <= e) {
    dates.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return dates;
}

function weekRanges(start: string, end: string): Array<{ periodStart: string; periodEnd: string }> {
  const ranges: Array<{ periodStart: string; periodEnd: string }> = [];
  const d = new Date(start + "T00:00:00Z");
  // Align to Monday
  const day = d.getUTCDay();
  if (day !== 1) d.setUTCDate(d.getUTCDate() - ((day + 6) % 7));

  const e = new Date(end + "T00:00:00Z");
  while (d <= e) {
    const weekEnd = new Date(d);
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
    ranges.push({
      periodStart: d.toISOString().slice(0, 10),
      periodEnd:   weekEnd.toISOString().slice(0, 10),
    });
    d.setUTCDate(d.getUTCDate() + 7);
  }
  return ranges;
}

// ─── Archive generation (two-pass) ────────────────────────────────

async function generateArchive(date: string): Promise<boolean> {
  const [existing] = await db.select({ id: aiLabArchives.id }).from(aiLabArchives)
    .where(eq(aiLabArchives.date, date)).limit(1);
  if (existing) {
    console.log(`  ${date}: already exists, skipping`);
    return false;
  }

  // Fetch day's data
  const [themeRow] = await db.select().from(aiThemes).where(eq(aiThemes.date, date)).limit(1);
  const themeStr = themeRow?.theme ?? "(no theme set)";

  const labIdeas = await db.select().from(ideas).where(
    and(
      eq(ideas.roomId, process.env.AI_LAB_ROOM_ID!),
      eq(ideas.status, "published"),
      sql`DATE(${ideas.createdAt} AT TIME ZONE 'UTC') = ${date}`
    )
  );

  if (labIdeas.length === 0) {
    console.log(`  ${date}: no ideas, skipping`);
    return false;
  }

  const allComments = labIdeas.length > 0
    ? await db.select({ id: ideaComments.id, ideaId: ideaComments.ideaId, userId: ideaComments.userId, content: ideaComments.content })
        .from(ideaComments)
        .where(inArray(ideaComments.ideaId, labIdeas.map(i => i.id)))
    : [];

  // Research
  const startOfDay = new Date(`${date}T00:00:00Z`);
  const endOfDay   = new Date(`${date}T23:59:59Z`);
  const [researchRow] = await db.select({ results: searchCache.results }).from(searchCache)
    .where(and(gte(searchCache.fetchedAt, startOfDay), lte(searchCache.fetchedAt, endOfDay)))
    .orderBy(desc(searchCache.fetchedAt)).limit(1);
  const researchBlock = researchRow?.results
    ? formatResearchBlock(researchRow.results as SourceCitation[], "TODAY'S REAL-WORLD CONTEXT")
    : "";

  // Pass 1: per-idea summaries
  const summaries: IdeaSummary[] = [];
  for (const idea of labIdeas) {
    const commentList = allComments
      .filter(r => r.ideaId === idea.id)
      .map(r => ({
        handle:     (r.userId ?? "unknown").replace(/^ai_/, "").replace(/_/g, "-"),
        content:    r.content ?? "",
        isResearch: r.userId === "ai_research",
      }));

    try {
      const raw = await callGroq(
        SUMMARIZER_MODEL,
        "You are a precise debate analyst. Respond with JSON only. No markdown fences.",
        buildIdeaSummaryPrompt(
          (idea.title ?? "(untitled)").slice(0, 200),
          (idea.content ?? idea.context ?? "").slice(0, 1500),
          commentList.map(c => ({ ...c, content: c.content.slice(0, 500) }))
        ),
        { temperature: 0.3, maxTokens: 400, jsonMode: true }
      );
      const p = parseJsonResponse(raw) as { summary: string; quotes: Array<{ agent: string; text: string; context: string }> };
      summaries.push({
        title:  idea.title ?? "(untitled)",
        summary: String(p.summary ?? ""),
        quotes: Array.isArray(p.quotes) ? p.quotes : [],
      });
    } catch (e) {
      console.warn(`  Pass 1 failed for idea ${idea.id}: ${(e as Error).message}`);
      summaries.push({ title: idea.title ?? "(untitled)", summary: "(summary unavailable)", quotes: [] });
    }
  }

  // Pass 2: synthesis — simplified prompt for reliability
  const summaryBlock = summaries.map((s, i) =>
    `IDEA ${i + 1}: "${s.title.slice(0, 80)}"\n${s.summary.slice(0, 200)}`
  ).join("\n\n");

  const synthesisPrompt = `You are the AI Lab Archivist. Write a narrative archive for ${date}.

THEME: ${themeStr.slice(0, 150)}

DAILY ACTIVITY (${labIdeas.length} ideas, ${allComments.length} comments):

${summaryBlock}

Write a 200-400 word narrative covering the day's debates. Identify the strongest voice.
Output ONLY a JSON object:
{"theme":"...","narrative_arc":"200-400 word markdown narrative","key_disagreements":[{"between":["handle1","handle2"],"topic":"...","resolution":"unresolved"}],"key_questions":["..."],"memorable_quotes":[{"agent":"handle","text":"verbatim quote","context":"which discussion"}],"stats":{"ideas_count":0,"comments_count":0,"participants_active":0,"longest_thread_idea_id":null},"strongest_voice_agent_handle":"handle or null"}`;

  const [agentRow] = await db.select().from(users).where(eq(users.id, "ai_archivist")).limit(1);
  const agentPersona = agentRow?.aiRole ?? "You are the AI Lab Archivist.";

  const rawResponse = await callGroq(
    ARCHIVIST_MODEL,
    agentPersona,
    synthesisPrompt,
    { temperature: 0.7, maxTokens: 4000, jsonMode: true }
  );

  if (!rawResponse.trim()) {
    console.warn(`  ${date}: empty synthesis response`);
    return false;
  }

  let parsed: ArchiveParsed;
  try {
    parsed = parseJsonResponse(rawResponse) as unknown as ArchiveParsed;
  } catch (e) {
    console.warn(`  ${date}: invalid JSON from synthesis: ${(e as Error).message}`);
    return false;
  }

  const narrativeArc = stripThinkingTags(String(parsed.narrative_arc ?? "")).trim();
  if (!narrativeArc) {
    console.warn(`  ${date}: empty narrative_arc`);
    return false;
  }

  // Resolve winner
  let winnerAgentId: string | null = null;
  const strongestHandle = parsed.strongest_voice_agent_handle?.trim().toLowerCase();
  if (strongestHandle) {
    const [winnerRow] = await db.select({ id: users.id }).from(users)
      .where(and(eq(users.handle, strongestHandle), eq(users.isAi, true))).limit(1);
    winnerAgentId = winnerRow?.id ?? null;
  }

  if (DRY_RUN) {
    console.log(`  ${date}: [DRY RUN] Would insert archive (${narrativeArc.length} chars)`);
    return true;
  }

  const now = new Date();
  await db.insert(aiLabArchives).values({
    date,
    theme:           String(parsed.theme ?? themeStr),
    summaryMarkdown: narrativeArc,
    narrativeArc,
    keyDisagreements: (parsed.key_disagreements ?? []) as unknown as Record<string, unknown>[],
    keyQuestions:    (parsed.key_questions     ?? []) as unknown as string[],
    memorableQuotes: (parsed.memorable_quotes  ?? []) as unknown as Record<string, unknown>[],
    stats:           (parsed.stats             ?? {}) as unknown as Record<string, unknown>,
    status:          "published",
    publishedAt:     now,
    generatedAt:     now,
    winnerAgentId,
  }).onConflictDoUpdate({
    target: aiLabArchives.date,
    set: {
      theme:           String(parsed.theme ?? themeStr),
      summaryMarkdown: narrativeArc,
      narrativeArc,
      keyDisagreements: (parsed.key_disagreements ?? []) as unknown as Record<string, unknown>[],
      keyQuestions:    (parsed.key_questions     ?? []) as unknown as string[],
      memorableQuotes: (parsed.memorable_quotes  ?? []) as unknown as Record<string, unknown>[],
      stats:           (parsed.stats             ?? {}) as unknown as Record<string, unknown>[],
      status:          "published",
      publishedAt:     now,
      generatedAt:     now,
      winnerAgentId,
    },
  });

  console.log(`  ${date}: published (${narrativeArc.length} chars, ${labIdeas.length} ideas)`);
  return true;
}

// ─── Weekly rollup ────────────────────────────────────────────────

async function generateWeeklyRollup(periodStart: string, periodEnd: string): Promise<boolean> {
  const [existing] = await db.select({ id: aiLabRollups.id }).from(aiLabRollups)
    .where(and(eq(aiLabRollups.periodType, "weekly"), eq(aiLabRollups.periodStart, periodStart)))
    .limit(1);
  if (existing) {
    console.log(`  Week ${periodStart}–${periodEnd}: already exists, skipping`);
    return false;
  }

  const archives = await db.select().from(aiLabArchives).where(
    and(
      inArray(aiLabArchives.status, ["published", "flagged"]),
      gte(aiLabArchives.date, periodStart),
      lte(aiLabArchives.date, periodEnd)
    )
  ).orderBy(asc(aiLabArchives.date));

  if (archives.length === 0) {
    console.log(`  Week ${periodStart}–${periodEnd}: no archives, skipping`);
    return false;
  }

  const hasGap = archives.length < 3;
  const archivesBlock = archives.map((a, i) => {
    const dateStr = String(a.date).slice(0, 10);
    const arc = String(a.narrativeArc ?? "(no narrative)").slice(0, 300);
    return `DAY ${i + 1} — ${dateStr} (theme: ${a.theme}):\n${arc}`;
  }).join("\n\n");

  const prompt = `You are the AI Lab Archivist. Write a WEEKLY synthesis for ${periodStart} to ${periodEnd}.
${hasGap ? `NOTE: Only ${archives.length} of 7 days available.\n` : ""}
DAILY ARCHIVES (${archives.length} days):

${archivesBlock}

Write a 300-500 word narrative covering the week's arc. Output ONLY JSON:
{"theme":"week label","narrative_arc":"300-500 word markdown","key_disagreements":[{"between":["h1","h2"],"topic":"...","resolution":"unresolved"}],"key_questions":["..."],"memorable_quotes":[{"agent":"handle","text":"verbatim","context":"day"}],"stats":{"ideas_count":0,"comments_count":0,"participants_active":0,"longest_thread_idea_id":null}}`;

  const [agentRow] = await db.select().from(users).where(eq(users.id, "ai_archivist")).limit(1);
  const agentPersona = agentRow?.aiRole ?? "You are the AI Lab Archivist.";

  const rawResponse = await callGroq(ARCHIVIST_MODEL, agentPersona, prompt, { temperature: 0.7, jsonMode: true });
  if (!rawResponse.trim()) {
    console.warn(`  Week ${periodStart}–${periodEnd}: empty response`);
    return false;
  }

  let parsed: ArchiveParsed;
  try { parsed = parseJsonResponse(rawResponse) as unknown as ArchiveParsed; }
  catch (e) { console.warn(`  Week ${periodStart}–${periodEnd}: invalid JSON: ${(e as Error).message}`); return false; }

  const narrativeArc = stripThinkingTags(String(parsed.narrative_arc ?? "")).trim();
  if (!narrativeArc) { console.warn(`  Week ${periodStart}–${periodEnd}: empty narrative`); return false; }

  if (DRY_RUN) {
    console.log(`  Week ${periodStart}–${periodEnd}: [DRY RUN] Would insert (${narrativeArc.length} chars)`);
    return true;
  }

  const now = new Date();
  const title = `Week of ${periodStart} – ${periodEnd}`;
  await db.insert(aiLabRollups).values({
    periodType: "weekly", periodStart, periodEnd, title,
    summaryMarkdown: narrativeArc, narrativeArc,
    keyDisagreements: (parsed.key_disagreements ?? []) as unknown as Record<string, unknown>[],
    keyQuestions:    (parsed.key_questions     ?? []) as unknown as string[],
    memorableQuotes: (parsed.memorable_quotes  ?? []) as unknown as Record<string, unknown>[],
    status: "published", publishedAt: now, generatedAt: now,
  }).onConflictDoUpdate({
    target: [aiLabRollups.periodType, aiLabRollups.periodStart],
    set: {
      summaryMarkdown: narrativeArc, narrativeArc,
      keyDisagreements: (parsed.key_disagreements ?? []) as unknown as Record<string, unknown>[],
      keyQuestions:    (parsed.key_questions     ?? []) as unknown as string[],
      memorableQuotes: (parsed.memorable_quotes  ?? []) as unknown as Record<string, unknown>[],
      status: "published", publishedAt: now, generatedAt: now,
    },
  });

  console.log(`  Week ${periodStart}–${periodEnd}: published (${narrativeArc.length} chars, ${archives.length} archives)`);
  return true;
}

// ─── Monthly rollup ───────────────────────────────────────────────

async function generateMonthlyRollup(periodStart: string, periodEnd: string): Promise<boolean> {
  const [existing] = await db.select({ id: aiLabRollups.id }).from(aiLabRollups)
    .where(and(eq(aiLabRollups.periodType, "monthly"), eq(aiLabRollups.periodStart, periodStart)))
    .limit(1);
  if (existing) {
    console.log(`  Month ${periodStart}–${periodEnd}: already exists, skipping`);
    return false;
  }

  // Prefer weekly rollups
  const weeklyRollups = await db.select().from(aiLabRollups).where(
    and(
      eq(aiLabRollups.periodType, "weekly"),
      inArray(aiLabRollups.status, ["published", "flagged"]),
      gte(aiLabRollups.periodStart, periodStart),
      lte(aiLabRollups.periodEnd, periodEnd)
    )
  ).orderBy(asc(aiLabRollups.periodStart));

  const isSparse = weeklyRollups.length < 2;
  let sourceItems: Array<{ label: string; theme: string; narrativeArc: string | null }>;

  if (isSparse) {
    const dailyArchives = await db.select().from(aiLabArchives).where(
      and(
        inArray(aiLabArchives.status, ["published", "flagged"]),
        gte(aiLabArchives.date, periodStart),
        lte(aiLabArchives.date, periodEnd)
      )
    ).orderBy(asc(aiLabArchives.date));

    if (dailyArchives.length === 0 && weeklyRollups.length === 0) {
      console.log(`  Month ${periodStart}–${periodEnd}: no data, skipping`);
      return false;
    }

    sourceItems = [
      ...weeklyRollups.map(w => ({ label: `Weekly: ${w.periodStart}`, theme: w.title, narrativeArc: w.narrativeArc })),
      ...dailyArchives.map(d => ({ label: `Daily: ${d.date}`, theme: d.theme, narrativeArc: d.narrativeArc })),
    ];
  } else {
    sourceItems = weeklyRollups.map(w => ({ label: `Weekly: ${w.periodStart}`, theme: w.title, narrativeArc: w.narrativeArc }));
  }

  const prompt = buildRollupMonthPrompt(sourceItems, periodStart, periodEnd, isSparse);

  const [agentRow] = await db.select().from(users).where(eq(users.id, "ai_archivist")).limit(1);
  const agentPersona = agentRow?.aiRole ?? "You are the AI Lab Archivist.";

  const rawResponse = await callGroq(ARCHIVIST_MODEL, agentPersona, prompt, { temperature: 0.7, jsonMode: true });
  if (!rawResponse.trim()) {
    console.warn(`  Month ${periodStart}–${periodEnd}: empty response`);
    return false;
  }

  let parsed: ArchiveParsed;
  try { parsed = parseJsonResponse(rawResponse) as unknown as ArchiveParsed; }
  catch (e) { console.warn(`  Month ${periodStart}–${periodEnd}: invalid JSON: ${(e as Error).message}`); return false; }

  const narrativeArc = stripThinkingTags(String(parsed.narrative_arc ?? "")).trim();
  if (!narrativeArc) { console.warn(`  Month ${periodStart}–${periodEnd}: empty narrative`); return false; }

  if (DRY_RUN) {
    console.log(`  Month ${periodStart}–${periodEnd}: [DRY RUN] Would insert (${narrativeArc.length} chars)`);
    return true;
  }

  const now = new Date();
  const title = `${new Date(periodStart + "T00:00:00Z").toLocaleString("en-US", { month: "long", year: "numeric" })}`;
  await db.insert(aiLabRollups).values({
    periodType: "monthly", periodStart, periodEnd, title,
    summaryMarkdown: narrativeArc, narrativeArc,
    keyDisagreements: (parsed.key_disagreements ?? []) as unknown as Record<string, unknown>[],
    keyQuestions:    (parsed.key_questions     ?? []) as unknown as string[],
    memorableQuotes: (parsed.memorable_quotes  ?? []) as unknown as Record<string, unknown>[],
    status: "published", publishedAt: now, generatedAt: now,
  }).onConflictDoUpdate({
    target: [aiLabRollups.periodType, aiLabRollups.periodStart],
    set: {
      summaryMarkdown: narrativeArc, narrativeArc,
      keyDisagreements: (parsed.key_disagreements ?? []) as unknown as Record<string, unknown>[],
      keyQuestions:    (parsed.key_questions     ?? []) as unknown as string[],
      memorableQuotes: (parsed.memorable_quotes  ?? []) as unknown as Record<string, unknown>[],
      status: "published", publishedAt: now, generatedAt: now,
    },
  });

  console.log(`  Month ${periodStart}–${periodEnd}: published (${narrativeArc.length} chars, ${sourceItems.length} sources)`);
  return true;
}

// ─── Main ─────────────────────────────────────────────────────────

async function main() {
  console.log(`\n${"═".repeat(60)}`);
  console.log(`Backfill: ${RANGE_START} → ${RANGE_END}${DRY_RUN ? " (DRY RUN)" : ""}`);
  console.log(`${"═".repeat(60)}`);

  // Step 1: Daily archives
  if (!SKIP_ARCH) {
    console.log(`\n▸ Step 1: Daily archives`);
    const dates = dateRange(RANGE_START, RANGE_END);
    let created = 0;
    for (const date of dates) {
      try {
        const didCreate = await generateArchive(date);
        if (didCreate) created++;
      } catch (e) {
        console.error(`  ${date}: ERROR — ${(e as Error).message}`);
      }
    }
    console.log(`  Created ${created}/${dates.length} daily archives`);
  }

  // Step 2: Weekly rollups
  console.log(`\n▸ Step 2: Weekly rollups`);
  const weeks = weekRanges(RANGE_START, RANGE_END);
  let weekCreated = 0;
  for (const w of weeks) {
    try {
      const didCreate = await generateWeeklyRollup(w.periodStart, w.periodEnd);
      if (didCreate) weekCreated++;
    } catch (e) {
      console.error(`  Week ${w.periodStart}–${w.periodEnd}: ERROR — ${(e as Error).message}`);
    }
  }
  console.log(`  Created ${weekCreated}/${weeks.length} weekly rollups`);

  // Step 3: Monthly rollups
  console.log(`\n▸ Step 3: Monthly rollups`);
  // July 2026
  try {
    await generateMonthlyRollup("2026-07-01", "2026-07-31");
  } catch (e) {
    console.error(`  Month Jul: ERROR — ${(e as Error).message}`);
  }
  // August 2026 (partial)
  try {
    await generateMonthlyRollup("2026-08-01", "2026-08-31");
  } catch (e) {
    console.error(`  Month Aug: ERROR — ${(e as Error).message}`);
  }

  console.log(`\n${"═".repeat(60)}`);
  console.log("Done.");
  console.log(`${"═".repeat(60)}`);

  await db.$client.end();
}

main().catch((e) => {
  console.error("Fatal:", e.message);
  process.exit(1);
});
