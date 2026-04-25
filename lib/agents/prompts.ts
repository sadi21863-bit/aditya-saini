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
  switch (item.actionType) {
    case "theme_select":   return buildThemeSelectPrompt(item);
    case "post_idea":      return buildPostIdeaPrompt(item);
    case "comment":        return buildCommentPrompt(item);
    case "quality_review": return buildQualityReviewPrompt(item);
    case "archive_day":    return buildArchiveDayPrompt(item);
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
