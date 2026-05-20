import type { AIQueue } from "@/db/schema";
import { formatResearchBlock, type SourceCitation } from "./research";

type Ctx = Record<string, unknown>;

/**
 * Pass 1 of two-pass archive generation.
 * Summarises a single idea's debate thread in ~150 words + verbatim quote candidates.
 * Each call is ~1,500–2,000 tokens — well within the 8k GitHub Models free-tier limit.
 */
export function buildIdeaSummaryPrompt(
  ideaTitle:    string,
  ideaContent:  string,
  comments: Array<{ handle: string; content: string; isResearch?: boolean }>
): string {
  const commentBlock = comments.length === 0
    ? "(no comments on this idea)"
    : comments
        .map((c, i) => `${i + 1}. @${c.handle}${c.isResearch ? " [research]" : ""}: ${c.content}`)
        .join("\n\n");

  return `Summarise this single AI Lab debate thread. Be analytical and precise.

IDEA: "${ideaTitle}"
CONTENT: ${ideaContent}

COMMENTS:
${commentBlock}

Write a 120–180 word summary covering:
- The core position staked in the idea
- The strongest challenge or pushback made
- Whether thinking shifted, and who moved
- What remains unresolved

Then list up to 2 verbatim quotes (copy exactly from the comments above, max 40 words each) that best capture the sharpest moments.

Respond with JSON only — no markdown fences:
{
  "summary": "120–180 word prose",
  "quotes": [
    { "agent": "handle", "text": "verbatim quote", "context": "what they were responding to" }
  ]
}`;
}

function ctx(item: AIQueue): Ctx {
  return (item.promptContext as Ctx) ?? {};
}

/**
 * Build the user-facing prompt for a queued action.
 * Prompts are intentionally simple for Week 2 — Week 3+ will add
 * richer context (e.g., thread history, recent archives).
 */
export function buildPrompt(item: AIQueue, researchInjection = ""): string {
  // comment actions route based on kind — mention_response uses a richer prompt
  if (item.actionType === "comment") {
    const c = (item.promptContext as Record<string, unknown>) ?? {};
    if (c.kind === "mention_response") return buildMentionResponsePrompt(item);
    if (c.kind === "debate_reply")     return buildDebateReplyPrompt(item, researchInjection);
    return buildCommentPrompt(item, researchInjection);
  }
  switch (item.actionType) {
    case "theme_select":   return buildThemeSelectPrompt(item);
    case "post_idea":      return buildPostIdeaPrompt(item);
    case "quality_review": return buildQualityReviewPrompt(item, researchInjection);
    case "lab_discussion": return buildLabDiscussionPrompt(item);
    // archive_day, quality_review_archive: self-contained in executor — never reach buildPrompt
    case "themeresearch":
    case "archive_day":
    case "quality_review_archive":
    case "rollup_week":
    case "rollup_month":
      throw new Error(`${item.actionType} is self-contained and should not reach buildPrompt`);
    default:
      throw new Error(`No prompt template for action type: ${item.actionType}`);
  }
}

function buildThemeSelectPrompt(item: AIQueue): string {
  const c = ctx(item);
  const recentThemes = Array.isArray(c.recentThemes) && c.recentThemes.length > 0
    ? (c.recentThemes as string[]).map(t => `- ${t}`).join("\n")
    : "- (none yet)";

  const researchBlock = Array.isArray(c.researchContext) && (c.researchContext as unknown[]).length > 0
    ? formatResearchBlock(c.researchContext as SourceCitation[], "TODAY'S REAL-WORLD SIGNALS")
    : "";

  return `TASK: Pick today's theme for the AI Lab.

RECENT THEMES (avoid repeating):
${recentThemes}
${researchBlock}
Select a theme that is specific, debate-worthy, and — when real-world signals are provided above — grounded in something that's actually happening now.

Respond with JSON matching your Theme Setter output schema.`;
}

function buildPostIdeaPrompt(item: AIQueue): string {
  const c = ctx(item);
  const theme    = String(c.theme    ?? "Open exploration");
  const rationale = c.rationale ? `THEME RATIONALE: ${c.rationale}\n` : "";
  const angles   = Array.isArray(c.suggestedAngles) && c.suggestedAngles.length > 0
    ? `ANGLES TO EXPLORE: ${(c.suggestedAngles as string[]).join(", ")}\n`
    : "";

  return `You're posting in the AI Lab today.

TODAY'S THEME: ${theme}
${rationale}${angles}
Post ONE original idea reflecting your personality. An idea has:
- Title (max 80 chars)
- Pitch (max 200 chars, one sentence)
- Content (2-4 paragraphs, 200-500 words)

Respond in JSON only. Use \\n to separate paragraphs inside the content field (no literal newlines):
{
  "title": "...",
  "pitch": "...",
  "content": "First paragraph.\\n\\nSecond paragraph.\\n\\nThird paragraph."
}`;
}

function buildCommentPrompt(item: AIQueue, researchInjection = ""): string {
  const c = ctx(item);
  const authorHandle = String(c.authorHandle ?? "another agent");
  const title        = c.ideaTitle   ? `TITLE: ${c.ideaTitle}\n`   : "";
  const pitch        = c.ideaPitch   ? `PITCH: ${c.ideaPitch}\n`   : "";
  const content      = c.ideaContent ? String(c.ideaContent)       : "(no content)";

  const mentionPrefix = c.isFromMention
    ? `A user on IdeaConnect tagged you for input on this idea:\n\n`
    : `Another agent just posted this in the AI Lab:\n\n`;

  return `${mentionPrefix}AUTHOR: @${authorHandle}
${title}${pitch}CONTENT: ${content}
${researchInjection}
Write ONE thoughtful comment (80-200 words) responding with your perspective.

Do NOT agree unless you genuinely agree with substance. Challenge assumptions, extend the idea, or bring a different angle. Start with your substantive take, not a sycophantic opener.`;
}

function buildQualityReviewPrompt(item: AIQueue, researchInjection = ""): string {
  const c = ctx(item);
  const targetType   = String(c.targetType   ?? "idea");
  const content      = String(c.content      ?? "");
  const theme        = c.theme ? `TODAY'S THEME: ${c.theme}\n` : "";
  const authorHandle = String(c.authorHandle ?? "unknown");

  const factualNote = researchInjection
    ? `\nIf the content makes factual claims, use the context above to assess accuracy.\nAdd a "factual_note" field to your JSON: "supported" | "unsupported" | "unverifiable".\n`
    : "";

  return `Review this post for the AI Lab:

TYPE: ${targetType}
AUTHOR: @${authorHandle}
CONTENT: ${content}
${theme}${researchInjection}${factualNote}
Apply the Quality Checker standards. Respond in JSON matching your output schema.`;
}

function buildArchiveDayPrompt(item: AIQueue): string {
  const c = ctx(item);
  const date           = String(c.date          ?? new Date().toISOString().slice(0, 10));
  const theme          = String(c.theme         ?? "(no theme set today)");
  const ideasPosted    = Number(c.ideasPosted    ?? 0);
  const commentsPosted = Number(c.commentsPosted ?? 0);
  const mentions       = Number(c.mentionsCount  ?? 0);
  const flaggedPosts   = Number(c.flaggedPosts   ?? 0);

  const agentActivity = Array.isArray(c.agentActivity)
    ? (c.agentActivity as string[]).join("\n")
    : "(no activity data)";

  return `Generate today's AI Lab archive summary.

DATE: ${date}
THEME: ${theme}

IDEAS POSTED TODAY: ${ideasPosted}
COMMENTS POSTED TODAY: ${commentsPosted}
HUMAN @MENTIONS: ${mentions}
${flaggedPosts > 0 ? `FLAGGED POSTS: ${flaggedPosts}\n` : ""}AGENT ACTIVITY:
${agentActivity}

Write the archive markdown following your Archivist schema.`;
}

// ─── Week 3: human @mention response ─────────────────────────────────

function buildMentionResponsePrompt(item: AIQueue): string {
  const c = ctx(item);
  const ideaTitle   = c.ideaTitle   ? `IDEA TITLE: ${c.ideaTitle}\n`   : "";
  const ideaContent = c.ideaContent ? `IDEA CONTENT: ${c.ideaContent}\n` : "";
  const mentionText = String(c.mention_text ?? "");

  return `A user on IdeaConnect tagged you in a comment and wants your input.

${ideaTitle}${ideaContent}USER'S COMMENT (containing your mention): ${mentionText}

Write ONE focused, substantive reply (100-200 words) directly addressing the user's question or point.

Stay in character. Lead with substance, not pleasantries. If the idea or argument has flaws, name them. If it's strong, say specifically why.

CRITICAL: This conversation is in a user's room. After you reply here, treat this as a standalone conversation — do not reference this specific user, idea, or topic in any other public context.`;
}

// ─── Debate reply ────────────────────────────────────────────────────

function buildDebateReplyPrompt(item: AIQueue, researchInjection = ""): string {
  const c = ctx(item);
  const commenterHandle  = String(c.commenterHandle  ?? "another agent");
  const commenterComment = String(c.commenterComment ?? "");
  const ideaTitle        = c.ideaTitle   ? `YOUR IDEA TITLE: ${c.ideaTitle}\n`   : "";
  const ideaPitch        = c.ideaPitch   ? `YOUR PITCH: ${c.ideaPitch}\n`        : "";
  const ideaContent      = c.ideaContent ? `YOUR IDEA: ${c.ideaContent}\n`       : "";

  return `You posted an idea in the AI Lab and @${commenterHandle} has responded to it.

${ideaTitle}${ideaPitch}${ideaContent}
@${commenterHandle} COMMENTED: ${commenterComment}
${researchInjection}
Reply directly to @${commenterHandle}. Either defend your position with new reasoning, acknowledge a valid point and sharpen your argument, or expose a specific flaw in their take.

RULES:
- Address @${commenterHandle} by handle in your reply
- Stay under 150 words — this is a debate exchange, not another essay
- Don't just restate your idea — respond to what they actually said
- No sycophantic opener ("Great point…", "You raise a good…") — start with your substantive response`;
}

// ─── Week 4: Quality Checker archive review ──────────────────────────

/**
 * Builds the QC prompt for reviewing a draft archive.
 *
 * Critically, each claimed memorable quote is shown next to the actual source
 * comment from the database so the QC can verify verbatim fidelity without
 * needing to query the DB itself.
 */
export function buildQualityReviewArchivePrompt(
  archive: {
    narrativeArc:    string | null;
    keyDisagreements: unknown;
    memorableQuotes:  unknown;
  },
  sourceIdeas: Array<{
    id: string;
    userId: string | null;
    title: string | null;
    content: string | null;
    context: string | null;
  }>,
  sourceComments: Array<{
    id: string;
    ideaId: string;
    userId: string | null;
    content: string;
  }>
): string {
  const narrativeArc = String(archive.narrativeArc ?? "(no narrative)");

  const disagreements = Array.isArray(archive.keyDisagreements) && archive.keyDisagreements.length > 0
    ? (archive.keyDisagreements as Array<Record<string, unknown>>)
        .map((d) => {
          const between = Array.isArray(d.between) ? (d.between as string[]).join(" vs ") : "?";
          return `- ${between}: ${d.topic} [${d.resolution}]`;
        })
        .join("\n")
    : "(none)";

  const quotes = Array.isArray(archive.memorableQuotes) ? archive.memorableQuotes : [];

  const quotesBlock = quotes.length === 0
    ? "(no memorable quotes)"
    : (quotes as Array<Record<string, unknown>>).map((q, i) => {
        const agentHandle  = String(q.agent  ?? "");
        const claimedText  = String(q.text   ?? "");
        const context      = String(q.context ?? "(none)");
        const agentUserId  = `ai_${agentHandle.replace(/-/g, "_")}`;

        const agentComments = sourceComments.filter((c) => c.userId === agentUserId);
        const verbatimSource = agentComments.find((c) => c.content.includes(claimedText));

        let sourceLabel: string;
        if (verbatimSource) {
          sourceLabel = `FOUND VERBATIM in source comment: "${verbatimSource.content}"`;
        } else if (agentComments.length > 0) {
          const excerpts = agentComments.slice(0, 2).map((c) => `"${c.content}"`).join("\n       ");
          sourceLabel = `NOT FOUND VERBATIM. @${agentHandle}'s actual comments:\n       ${excerpts}`;
        } else {
          sourceLabel = `NOT FOUND — @${agentHandle} made no comments in this session`;
        }

        return `QUOTE ${i + 1}:
  Attributed to: @${agentHandle}
  Claimed text: "${claimedText}"
  Context: ${context}
  Source check: ${sourceLabel}`;
      }).join("\n\n");

  const ideasBlock = sourceIdeas.length === 0
    ? "(no ideas posted)"
    : sourceIdeas.map((idea, i) => {
        const handle = (idea.userId ?? "").replace(/^ai_/, "").replace(/_/g, "-");
        return `IDEA ${i + 1} by @${handle}: "${idea.title}"\n${idea.content ?? idea.context ?? ""}`;
      }).join("\n\n");

  const commentsBlock = sourceComments.length === 0
    ? "(no comments)"
    : sourceComments.map((c, i) => {
        const handle = (c.userId ?? "").replace(/^ai_/, "").replace(/_/g, "-");
        return `COMMENT ${i + 1} by @${handle}: "${c.content}"`;
      }).join("\n\n");

  return `You are the Quality Checker reviewing a draft AI Lab archive before publication.

TASK: Verify this archive is accurate and publication-ready. You have both the archive content AND the original source data. Check the archive against the source.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ARCHIVE CONTENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

NARRATIVE ARC:
${narrativeArc}

KEY DISAGREEMENTS:
${disagreements}

MEMORABLE QUOTES (each shown with its actual source comment for verbatim verification):
${quotesBlock}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SOURCE DATA (ground truth)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

IDEAS:
${ideasBlock}

COMMENTS:
${commentsBlock}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VERDICT CRITERIA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FLAG this archive if ANY of the following is true:
1. A claimed memorable quote does not appear verbatim in its source comment ("NOT FOUND VERBATIM" or "made no comments" above).
2. The narrative uses sycophantic or generic praise language (e.g., "rich and engaging discussion", "insightful", "lively debate", "thoughtful contributions").
3. The narrative attributes a position or argument to the wrong agent handle — check each attribution against the source comments.
4. The narrative describes a disagreement or debate that is not present in the source ideas and comments.

PUBLISH this archive only if none of the above apply.

Respond with ONLY this JSON object — no prose, no code fences:
{
  "verdict": "publish" | "flag",
  "reason": "One sentence explaining your verdict"
}`;
}

// ─── Week 4 Step 5: Rollup prompt builders ───────────────────────────

export function buildRollupWeekPrompt(
  archives: Array<{
    date: string | Date;
    theme: string;
    narrativeArc: string | null;
    keyDisagreements: unknown;
  }>,
  periodStart: string,
  periodEnd:   string,
  hasGap:      boolean
): string {
  const archiveCount = archives.length;

  const gapNote = hasGap
    ? `NOTE: Only ${archiveCount} of 7 expected daily archives are available for this period. Generate based on what exists; note the gap in the narrative.\n\n`
    : "";

  const archivesBlock = archiveCount === 0
    ? "(no daily archives available for this period)"
    : archives.map((a, i) => {
        const dateStr = String(a.date).slice(0, 10);
        const disagreements = Array.isArray(a.keyDisagreements) && a.keyDisagreements.length > 0
          ? `Key disagreements: ${(a.keyDisagreements as Array<Record<string, unknown>>)
              .map((d) => String(d.topic ?? ""))
              .join(", ")}`
          : "No major disagreements recorded.";
        const arc = String(a.narrativeArc ?? "(no narrative)").slice(0, 600);
        return `DAY ${i + 1} — ${dateStr} (theme: ${a.theme}):\n${arc}\n${disagreements}`;
      }).join("\n\n────────────────────────\n\n");

  return `You are the Archivist for IdeaConnect's AI Lab. Generate a WEEKLY synthesis narrative.

PERIOD: ${periodStart} to ${periodEnd}
${gapNote}DAILY ARCHIVES (${archiveCount} days):

${archivesBlock}

────────────────────────
Synthesize what happened across this week. Your narrative_arc must cover:
- Which themes recurred or evolved across multiple days?
- Which debates continued over more than one day, and how did they develop?
- What was resolved by end of week? What remained unresolved?
- What were the week's most significant intellectual moments?

The narrative_arc should be 400-800 words covering the WEEK's arc, not any single day.
memorable_quotes entries must be byte-for-byte verbatim from a specific daily archive's narrative text.

Respond with ONLY a JSON object matching this exact schema (no prose, no code fences):
{
  "theme": "One-phrase label for the week's dominant thread",
  "narrative_arc": "400-800 word markdown narrative of the week",
  "key_disagreements": [{ "between": ["handle1","handle2"], "topic": "...", "resolution": "unresolved|converged|one_persuaded" }],
  "key_questions": ["Question the week raised but did not resolve"],
  "memorable_quotes": [{ "agent": "handle", "text": "Verbatim excerpt from a daily archive narrative", "context": "Which day/discussion" }],
  "stats": { "ideas_count": 0, "comments_count": 0, "participants_active": 0, "longest_thread_idea_id": null }
}`;
}

export function buildRollupMonthPrompt(
  sourceItems: Array<{ label: string; theme: string; narrativeArc: string | null }>,
  periodStart:       string,
  periodEnd:         string,
  usingDailyFallback: boolean
): string {
  const sourceType = usingDailyFallback ? "daily archives" : "weekly rollups";
  const itemCount  = sourceItems.length;

  const sourcesBlock = itemCount === 0
    ? "(no source data available for this period)"
    : sourceItems.map((item, i) => {
        const arc = String(item.narrativeArc ?? "(no narrative)").slice(0, 500);
        return `SOURCE ${i + 1} — ${item.label} (theme: ${item.theme}):\n${arc}`;
      }).join("\n\n────────────────────────\n\n");

  return `You are the Archivist for IdeaConnect's AI Lab. Generate a MONTHLY synthesis narrative.

PERIOD: ${periodStart} to ${periodEnd}
SOURCE TYPE: ${sourceType} (${itemCount} items)

${sourcesBlock}

────────────────────────
Synthesize the month's intellectual arc. Your narrative_arc must identify:
- What were the month's dominant themes and how did they connect?
- Which debates or questions persisted across weeks?
- What shifted in how agents approached problems over the month?
- What is the single most important unresolved question the month leaves behind?

The narrative_arc should be 500-900 words covering the MONTH's arc.
memorable_quotes entries must be byte-for-byte verbatim excerpts from the source items above.

Respond with ONLY a JSON object matching this exact schema (no prose, no code fences):
{
  "theme": "One-phrase label for the month's dominant thread",
  "narrative_arc": "500-900 word markdown narrative of the month",
  "key_disagreements": [{ "between": ["handle1","handle2"], "topic": "...", "resolution": "unresolved|converged|one_persuaded" }],
  "key_questions": ["Question the month raised but did not resolve"],
  "memorable_quotes": [{ "agent": "handle", "text": "Verbatim excerpt from source", "context": "Which week/day" }],
  "stats": { "ideas_count": 0, "comments_count": 0, "participants_active": 0, "longest_thread_idea_id": null }
}`;
}

export function buildQualityReviewRollupPrompt(
  rollup: {
    narrativeArc:    string | null;
    keyDisagreements: unknown;
    memorableQuotes:  unknown;
    periodType:       string | null;
  },
  sourceArchives: Array<{ date: string; theme: string; narrativeArc: string | null }>
): string {
  const rollupType   = String(rollup.periodType ?? "rollup").toLowerCase();
  const narrativeArc = String(rollup.narrativeArc ?? "(no narrative)");

  const disagreements = Array.isArray(rollup.keyDisagreements) && rollup.keyDisagreements.length > 0
    ? (rollup.keyDisagreements as Array<Record<string, unknown>>)
        .map((d) => {
          const between = Array.isArray(d.between) ? (d.between as string[]).join(" vs ") : "?";
          return `- ${between}: ${d.topic} [${d.resolution}]`;
        })
        .join("\n")
    : "(none)";

  const quotesBlock = Array.isArray(rollup.memorableQuotes) && rollup.memorableQuotes.length > 0
    ? (rollup.memorableQuotes as Array<Record<string, unknown>>).map((q, i) => {
        const claimedText = String(q.text ?? "");
        const context     = String(q.context ?? "(none)");
        const foundIn = sourceArchives.find(
          (a) => String(a.narrativeArc ?? "").includes(claimedText)
        );
        const sourceNote = foundIn
          ? `FOUND VERBATIM in daily archive for ${String(foundIn.date).slice(0, 10)}`
          : `NOT FOUND VERBATIM in any source archive`;
        return `QUOTE ${i + 1}: @${q.agent} — "${claimedText}" (context: ${context})\n  Source check: ${sourceNote}`;
      }).join("\n\n")
    : "(no memorable quotes)";

  const sourcesBlock = sourceArchives.length === 0
    ? "(no source archives available)"
    : sourceArchives.map((a, i) => {
        const arc = String(a.narrativeArc ?? "(no narrative)").slice(0, 500);
        return `ARCHIVE ${i + 1} — ${String(a.date).slice(0, 10)} (theme: ${a.theme}):\n${arc}`;
      }).join("\n\n────────────────────────\n\n");

  return `You are the Quality Checker reviewing a draft ${rollupType} rollup summary before publication.

TASK: Verify this rollup accurately synthesizes its source archives. You have both the rollup content AND the underlying daily archives as ground truth.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ROLLUP CONTENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

NARRATIVE ARC:
${narrativeArc}

KEY DISAGREEMENTS:
${disagreements}

MEMORABLE QUOTES (each shown with source check):
${quotesBlock}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SOURCE ARCHIVES (ground truth)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${sourcesBlock}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VERDICT CRITERIA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FLAG this rollup if ANY of the following is true:
1. The narrative claims a cross-period pattern or debate that is NOT supported by the source archives.
2. The narrative implies false consensus — claims debates were resolved when the source archives show they were not.
3. A claimed memorable quote is "NOT FOUND VERBATIM in any source archive."
4. The narrative uses sycophantic or generic praise language (e.g., "rich and engaging", "insightful").
5. The narrative attributes a position to an agent that is contradicted by the source archives.

PUBLISH only if none of the above apply.

Respond with ONLY this JSON object (no prose, no code fences):
{
  "verdict": "publish" | "flag",
  "reason": "One sentence explaining your verdict"
}`;
}

// ─── Week 3: Lab discussion echo ─────────────────────────────────────

function buildLabDiscussionPrompt(item: AIQueue): string {
  const c       = ctx(item);
  const summary = String(c.source_idea_summary ?? "a topic raised by a user");

  return `A user recently tagged you for input on a topic in their room. You responded to them privately.

TOPIC SUMMARY (do NOT reveal user identity or specific details): ${summary}

Now post in the AI Lab reflecting on the broader theme this topic represents. Speak generally — about the concept, not the specific conversation. Invite the other agents to weigh in.

Post ONE original idea (2-3 paragraphs, 150-350 words) that:
- Engages with the broader theme without identifying any individual user
- Brings your unique perspective (practical/skeptical/synthesizing, per your persona)
- Ends with a specific question or challenge directed at another agent

Respond in JSON only. Use \\n for line breaks inside the content field:
{
  "title": "...",
  "pitch": "...",
  "content": "..."
}`;
}

// ─── QUICK DEBATE PROMPTS ────────────────────────────────────────────────────

export function buildJudgeEvaluationPrompt(
  input: string,
  clarification?: { question: string; answer: string }
): string {
  const clarificationBlock = clarification
    ? `\nUser's clarification:\nQ: "${clarification.question}"\nA: "${clarification.answer}"\n`
    : "";

  return `You are the Quick Debate Judge for IdeaConnect.

User input:
"""
${input}
"""
${clarificationBlock}
Your job:

1. Decide if you need ONE clarifying question. Skip this if the input is
   longer than 30 words and specific. Only ask if genuinely ambiguous about
   scope or goal. Never ask more than one question.

2. Route to:
   "single_answer" — factual questions, advice requests, things with one
   correct or best answer, too narrow for meaningful debate.
   "full_debate" — ideas, proposals, hypotheses, plans, predictions,
   anything where two intelligent people could reasonably disagree.

3. If full_debate: pick 2 agents and a mode.
   Agents: ai_llama (practical builder), ai_gpt_oss (synthesizer/connector),
   ai_scout (explorer/lateral), ai_maverick (bold/contrarian).
   Always pair one builder-type with one skeptic-type for maximum tension.

   MODE SELECTION — this is critical:
   "risk_scan" for: declarative predictions ("X will happen by year Y"),
   comparative claims ("X is better than Y"), causal claims ("X is causing Y"),
   or any statement structured as a conclusion to be challenged.
   The agents will find failure modes and false assumptions in the premise.

   "brainstorm" for: open questions ("how might we...", "what would happen if..."),
   half-formed ideas, explorations without a fixed conclusion.
   The agents will build on and extend the idea.

   When in doubt, default to risk_scan. A sharp disagreement is more useful
   than a friendly extension session.

Respond in this exact JSON structure. All fields always present. Null fields that don't apply.
{
  "needs_clarification": false,
  "question": null,
  "verdict": "full_debate",
  "reasoning": "one sentence explaining the routing decision",
  "answer": null,
  "recommended_agents": ["ai_llama", "ai_maverick"],
  "recommended_mode": "risk_scan"
}

If needs_clarification is true, return:
{
  "needs_clarification": true,
  "question": "your one specific question",
  "verdict": null,
  "reasoning": null,
  "answer": null,
  "recommended_agents": null,
  "recommended_mode": null
}`;
}

const DEBATE_MODE_FRAMES: Record<string, string> = {
  brainstorm: `Build on this idea. Extend it. Find adjacent applications and unexplored
angles. Be generative, not critical. Add something the user hasn't considered yet.`,
  risk_scan: `Find failure modes. What breaks first? What assumption is most likely wrong?
Be specific — one concrete risk per paragraph. Not "it might fail" but "it will fail at X because Y."`,
};

export function buildDebateTurnPrompt(args: {
  debate:     { originalInput: string; judgeReasoning: string | null; debateMode: string | null };
  agent:      { name: string; persona: string };
  agentATurn: { content: string; agentId: string | null } | null;
  agentAName: string | null;
  question?:  { question: string; answer: string | null } | null;
}): string {
  const { debate, agent, agentATurn, agentAName, question } = args;

  const clarificationBlock =
    question?.answer
      ? `\nUSER CLARIFIED:\nQ: "${question.question}"\nA: "${question.answer}"\n`
      : "";

  const modeFrame = DEBATE_MODE_FRAMES[debate.debateMode ?? "brainstorm"] ?? DEBATE_MODE_FRAMES.brainstorm;

  const agentBBlock =
    agentATurn && agentAName
      ? `\nWHAT ${agentAName.toUpperCase()} JUST ARGUED:
"${agentATurn.content}"

Your response MUST follow this structure:
1. In one sentence, name the SPECIFIC claim from ${agentAName} you disagree with most. Not a paraphrase of the original idea — the specific thing ${agentAName} just said.
2. Explain exactly why that specific claim is wrong or incomplete. Use a concrete example, a named counterexample, or a logical flaw in the reasoning.
3. Then and only then, make your own argument.

Do NOT change the subject. Do NOT reframe the question as a different problem. Engage with what ${agentAName} actually said.\n`
      : "";

  return `You are ${agent.name} in a Quick Debate on IdeaConnect.

IDEA SUBMITTED:
"${debate.originalInput}"
${clarificationBlock}
JUDGE'S ROUTING REASONING:
"${debate.judgeReasoning ?? "This idea warrants multiple perspectives."}"

DEBATE MODE: ${(debate.debateMode ?? "brainstorm").replace("_", " ").toUpperCase()}
${modeFrame}
${agent.persona}
Write your contribution in 100–200 words.
No sycophantic openers. Start with your substantive point.
${agentBBlock}`;
}

export function buildDebateArchivePrompt(args: {
  debate:     { originalInput: string; debateMode: string | null };
  agentATurn: { content: string };
  agentBTurn: { content: string };
  agentAName: string;
  agentBName: string;
}): { systemPrompt: string; userPrompt: string } {
  const { debate, agentATurn, agentBTurn, agentAName, agentBName } = args;

  const systemPrompt =
    `You summarize AI debates for public sharing.
Write 150 words of plain prose. No headers. No bullet points.
Write for someone who was not in the debate.`;

  const userPrompt =
`ORIGINAL IDEA: "${debate.originalInput}"
DEBATE MODE: ${debate.debateMode ?? "brainstorm"}
${agentAName}: "${agentATurn.content}"
${agentBName}: "${agentBTurn.content}"

Write a 150-word plain prose summary. Structure it as follows:

First: state the crux — the single specific claim both agents actually dispute. Not a restatement of the original idea. The specific disagreement that emerged in this exchange.

Second: state what would need to be true for ${agentAName} to be right. State what would need to be true for ${agentBName} to be right.

Third: state which argument is more defensible on this specific crux, and why. Take a position. Do not say "both perspectives are valid" or "the answer lies somewhere in between."

No headers. No bullet points. Plain prose. Write for someone who has 30 seconds.`;

  return { systemPrompt, userPrompt };
}

// ─── ROUND 2 PROMPTS ─────────────────────────────────────────────────────────

export function buildRound2TurnPrompt(args: {
  debate:            { originalInput: string; archivistSummary: string | null };
  agent:             { name: string; persona: string };
  slot:              0 | 1;
  round1AgentATurn:  { content: string };
  round1AgentBTurn:  { content: string };
  round2AgentATurn?: { content: string };
  agentAName:        string;
  agentBName:        string;
}): string {
  const { debate, agent, slot, round1AgentATurn, round1AgentBTurn, round2AgentATurn, agentAName, agentBName } = args;

  if (slot === 0) {
    return `You are ${agent.name} in Round 2 of a Quick Debate on IdeaConnect.

ORIGINAL IDEA: "${debate.originalInput}"

YOUR ROUND 1 ARGUMENT:
"${round1AgentATurn.content}"

${agentBName.toUpperCase()}'S ATTACK ON YOUR ARGUMENT:
"${round1AgentBTurn.content}"

${agent.persona}

Write 100–150 words. Do NOT start your response with a label like "DEFEND" or "CONCEDE".

You have ONE response. Either defend or concede — not both:

To defend: provide new reasoning that directly addresses ${agentBName}'s specific attack. Do not repeat your Round 1 argument. Bring a new example, a named counterexample to their counterexample, or a logical flaw in their attack.

To concede and redirect: explicitly acknowledge that ${agentBName}'s attack is correct on this specific point, then make a different claim you ARE prepared to defend.

Do NOT restate the original idea. Respond to what ${agentBName} actually said.`;
  }

  const round2AContent = round2AgentATurn?.content ?? "";
  return `You are ${agent.name} in Round 2 of a Quick Debate on IdeaConnect.

ORIGINAL IDEA: "${debate.originalInput}"

YOUR ROUND 1 ARGUMENT:
"${round1AgentBTurn.content}"

${agentAName.toUpperCase()}'S ROUND 2 RESPONSE:
"${round2AContent}"

${agent.persona}

Write 100–150 words.

Did ${agentAName} defend their position with new reasoning, or did they concede and redirect?

If they defended: attack the new reasoning directly. Do not re-litigate Round 1.
If they conceded and redirected: attack the new claim they redirected to.
Either way: name the specific thing they said in Round 2 before responding.`;
}

export function buildRound2ArchivePrompt(args: {
  debate:            { originalInput: string; archivistSummary: string | null };
  round1AgentATurn:  { content: string };
  round1AgentBTurn:  { content: string };
  round2AgentATurn:  { content: string };
  round2AgentBTurn:  { content: string };
  agentAName:        string;
  agentBName:        string;
}): { systemPrompt: string; userPrompt: string } {
  const { debate, round1AgentATurn, round1AgentBTurn, round2AgentATurn, round2AgentBTurn, agentAName, agentBName } = args;

  const systemPrompt =
    `You summarize AI debates for public sharing.
Write for someone who was not in the debate.`;

  const userPrompt =
`ORIGINAL IDEA: "${debate.originalInput}"
CRUX FROM ROUND 1: "${debate.archivistSummary ?? "(not available)"}"

ROUND 1:
${agentAName}: "${round1AgentATurn.content}"
${agentBName}: "${round1AgentBTurn.content}"

ROUND 2:
${agentAName}: "${round2AgentATurn.content}"
${agentBName}: "${round2AgentBTurn.content}"

Write two sections of plain prose (no section headers in the prose):

SECTION 1 (~75 words): Who shifted and who held ground.
State observable facts only — what each agent actually did between Round 1 and Round 2. Examples:
- "${agentAName} repeated their original claim without addressing ${agentBName}'s counterexample about [X]."
- "${agentBName} conceded the [X] point and redirected to [Y]."
- "${agentAName} introduced [new example] in Round 2 that directly addresses ${agentBName}'s Round 1 attack."
Do not say "more defensible" or "both raised valid points."

SECTION 2 (~75 words): Verdict.
Name a winner on the crux. Support it with one observable fact from the exchange — something one agent did or failed to do that is visible in the turns above. The winner is whoever held their position on the crux with new reasoning. If neither agent addressed the crux in Round 2, say so explicitly and name the exchange as unresolved.

Respond with this JSON only. No prose outside the JSON. No markdown fences.
{
  "verdict_reasoning": "~150 words of plain prose covering both sections",
  "verdict": "One sentence naming the winner on the crux with the observable fact that supports it. If unresolved, say so explicitly."
}`;

  return { systemPrompt, userPrompt };
}
