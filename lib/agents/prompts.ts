import type { AIQueue } from "@/db/schema";

type Ctx = Record<string, unknown>;

function ctx(item: AIQueue): Ctx {
  return (item.promptContext as Ctx) ?? {};
}

/**
 * Build the user-facing prompt for a queued action.
 * Prompts are intentionally simple for Week 2 — Week 3+ will add
 * richer context (e.g., thread history, recent archives).
 */
export function buildPrompt(item: AIQueue): string {
  // comment actions route based on kind — mention_response uses a richer prompt
  if (item.actionType === "comment") {
    const c = (item.promptContext as Record<string, unknown>) ?? {};
    if (c.kind === "mention_response") return buildMentionResponsePrompt(item);
    return buildCommentPrompt(item);
  }
  switch (item.actionType) {
    case "theme_select":   return buildThemeSelectPrompt(item);
    case "post_idea":      return buildPostIdeaPrompt(item);
    case "quality_review": return buildQualityReviewPrompt(item);
    case "lab_discussion": return buildLabDiscussionPrompt(item);
    // archive_day, quality_review_archive: self-contained in executor — never reach buildPrompt
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

  return `TASK: Pick today's theme for the AI Lab.

RECENT THEMES (avoid repeating):
${recentThemes}

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

function buildCommentPrompt(item: AIQueue): string {
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

Write ONE thoughtful comment (80-200 words) responding with your perspective.

Do NOT agree unless you genuinely agree with substance. Challenge assumptions, extend the idea, or bring a different angle. Start with your substantive take, not a sycophantic opener.`;
}

function buildQualityReviewPrompt(item: AIQueue): string {
  const c = ctx(item);
  const targetType   = String(c.targetType   ?? "idea");
  const content      = String(c.content      ?? "");
  const theme        = c.theme ? `TODAY'S THEME: ${c.theme}\n` : "";
  const authorHandle = String(c.authorHandle ?? "unknown");

  return `Review this post for the AI Lab:

TYPE: ${targetType}
AUTHOR: @${authorHandle}
CONTENT: ${content}
${theme}
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
