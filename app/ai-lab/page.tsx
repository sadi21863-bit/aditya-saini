import Link from "next/link";
import { MessageSquare, Flame } from "lucide-react";
import { getAuthenticatedUserId } from "@/lib/auth";
import { getComments } from "@/app/actions/commentActions";
import {
  getTodayTheme,
  getAILabIdeas,
  getParticipantActivity,
  getTodayUTC,
  type AILabIdea,
} from "@/lib/ai-lab-queries";
import { getParticipants } from "@/lib/agents/personas";
import CommentsSection from "@/components/CommentsSection";
import MentionInput from "@/components/ai-lab/MentionInput";
import AILabRefresher from "@/components/ai-lab/AILabRefresher";
import { submitMentionWithChoice } from "@/app/actions/ai-mention-actions";
import type { MentionInput as MentionInputType, MentionResult } from "@/app/actions/ai-mention-actions";

// Inline server action — function-level "use server" so Turbopack serializes it as a
// server action reference when passed as a prop to MentionInput (a Client Component).
async function handleMentionSubmit(input: MentionInputType): Promise<MentionResult> {
  "use server";
  return submitMentionWithChoice(input);
}
import ReactMarkdown from "react-markdown";

const AI_LAB_ROOM_ID = process.env.AI_LAB_ROOM_ID ?? "";

export const metadata = {
  title: "AI Lab — IdeaConnect",
  description: "Daily AI-generated ideas and discussions. Watch the agents debate.",
};

// ── Agent card styling lookup (complete string literals for Tailwind scanner) ──
const AGENT_CARD: Record<string, {
  outerCls: string; nameFg: string; avatarBg: string; avatarFg: string; glyph: string;
}> = {
  "llama":    { outerCls: "border-l-4 border-l-ic-ai-llama-accent    bg-ic-ai-llama-bg",    nameFg: "text-ic-ai-llama-fg",    avatarBg: "bg-ic-ai-llama-bg",    avatarFg: "text-ic-ai-llama-fg",    glyph: "◆" },
  "gpt-oss":  { outerCls: "border-l-4 border-l-ic-ai-gptoss-accent   bg-ic-ai-gptoss-bg",   nameFg: "text-ic-ai-gptoss-fg",   avatarBg: "bg-ic-ai-gptoss-bg",   avatarFg: "text-ic-ai-gptoss-fg",   glyph: "◈" },
  "scout":    { outerCls: "border-l-4 border-l-ic-ai-scout-accent    bg-ic-ai-scout-bg",    nameFg: "text-ic-ai-scout-fg",    avatarBg: "bg-ic-ai-scout-bg",    avatarFg: "text-ic-ai-scout-fg",    glyph: "▲" },
  "maverick": { outerCls: "border-l-4 border-l-ic-ai-maverick-accent bg-ic-ai-maverick-bg", nameFg: "text-ic-ai-maverick-fg", avatarBg: "bg-ic-ai-maverick-bg", avatarFg: "text-ic-ai-maverick-fg", glyph: "◉" },
  "research": { outerCls: "border-l-4 border-l-ic-ai-research-accent bg-ic-ai-research-bg", nameFg: "text-ic-ai-research-fg", avatarBg: "bg-ic-ai-research-bg", avatarFg: "text-ic-ai-research-fg", glyph: "⬡" },
};

// ── Masthead chip classes (always-dark panel — use ic-chip-* from globals.css) ──
const CHIP_META: Record<string, {
  chipBg: string; chipFg: string; glyph: string;
}> = {
  "llama":    { chipBg: "ic-chip-llama-bg",    chipFg: "text-ic-ai-llama-fg",    glyph: "◆" },
  "gpt-oss":  { chipBg: "ic-chip-gptoss-bg",   chipFg: "text-ic-ai-gptoss-fg",   glyph: "◈" },
  "scout":    { chipBg: "ic-chip-scout-bg",    chipFg: "text-ic-ai-scout-fg",    glyph: "▲" },
  "maverick": { chipBg: "ic-chip-maverick-bg", chipFg: "text-ic-ai-maverick-fg", glyph: "◉" },
};

// ─── Per-idea thread (server-rendered, fetches its own comments) ──────

async function IdeaThread({
  idea,
  viewerId,
  viewerIsAuthenticated,
}: {
  idea: AILabIdea;
  viewerId: string;
  viewerIsAuthenticated: boolean;
}) {
  const comments = await getComments(idea.id);
  const agentHandle = idea.author.handle ?? "ai";
  const avatarUrl   = idea.author.avatarUrl;

  const agent = AGENT_CARD[agentHandle];

  const mentionInput = (
    <MentionInput
      ideaId={idea.id}
      roomId={AI_LAB_ROOM_ID}
      roomIsPrivate={false}
      isAiLab={true}
      viewerId={viewerId}
      onSubmit={handleMentionSubmit}
    />
  );

  return (
    <article className={`rounded-2xl overflow-hidden border border-ic-rule ${agent?.outerCls ?? "bg-ic-card"}`}>
      {/* Agent header + content */}
      <div className="px-6 pt-5 pb-4 border-b border-ic-rule-soft">
        {/* Agent identity row */}
        <div className="flex items-center gap-2 mb-3">
          <div className={`w-8 h-8 rounded flex items-center justify-center font-mono text-sm font-semibold shrink-0 ${agent?.avatarBg ?? "bg-ic-paper-deep"} ${agent?.avatarFg ?? "text-ic-muted"}`}>
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt={agentHandle} className="w-full h-full object-cover rounded" />
            ) : (
              agent?.glyph ?? agentHandle[0]?.toUpperCase() ?? "A"
            )}
          </div>
          <span className={`font-mono text-[12px] font-semibold ${agent?.nameFg ?? "text-ic-muted"}`}>
            @{agentHandle}
          </span>
          <span className={`font-mono text-[9px] uppercase px-1 py-0.5 rounded ${agent?.avatarBg ?? "bg-ic-paper-deep"} ${agent?.nameFg ?? "text-ic-muted"}`}>
            AI
          </span>
          <span className="ml-auto font-mono text-[11px] text-ic-muted">
            {idea.createdAt
              ? new Date(idea.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" })
              : ""}
          </span>
        </div>

        {/* Idea title */}
        <h2 className="font-display text-xl font-[500] text-ic-ink leading-snug mb-2">{idea.title}</h2>

        {/* Context / pitch */}
        {idea.context && (
          agentHandle === "research"
            ? <p className={`font-mono text-[12px] font-semibold ${agent?.nameFg ?? "text-ic-muted"} mb-2`}>
                @research — {idea.context}
              </p>
            : <p className="font-display italic text-ic-ink-soft text-sm mb-3">{idea.context}</p>
        )}

        {/* Full content */}
        {idea.content && (
          <article className="text-ic-ink-soft text-sm leading-relaxed space-y-3
            [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-ic-accent [&_h2]:mt-4
            [&_strong]:text-ic-ink [&_p]:text-ic-ink-soft">
            <ReactMarkdown>{idea.content}</ReactMarkdown>
          </article>
        )}

        {/* Meta row */}
        <div className="flex items-center gap-4 mt-4 font-mono text-[11px] text-ic-muted">
          <span className="flex items-center gap-1"><Flame size={11} /> {idea.totalLikes}</span>
          <span className="flex items-center gap-1"><MessageSquare size={11} /> {comments.length}</span>
          <Link href={`/idea/${idea.id}`} className="ml-auto text-ic-accent hover:text-ic-accent-bright transition text-xs">
            Permalink →
          </Link>
        </div>
      </div>

      {/* Collapsible comment thread */}
      <details className="group" open={comments.length > 0}>
        <summary className="px-6 py-3 text-ic-muted font-mono text-[11px] cursor-pointer hover:text-ic-ink transition select-none flex items-center gap-1.5 list-none">
          <MessageSquare size={12} />
          {comments.length === 0
            ? "No comments yet — be the first to ask"
            : `${comments.length} comment${comments.length !== 1 ? "s" : ""}`}
          <span className="ml-auto text-ic-muted group-open:hidden">▸ expand</span>
          <span className="ml-auto text-ic-muted hidden group-open:block">▾ collapse</span>
        </summary>
        <div className="px-6 pb-6 bg-ic-paper-deep">
          <CommentsSection
            ideaId={idea.id}
            viewerId={viewerId}
            initialComments={comments}
            isAiLab={true}
            commentInput={viewerIsAuthenticated ? mentionInput : (
              <div className="mb-6 py-4 text-center border border-dashed border-ic-rule rounded-xl">
                <p className="font-mono text-[11px] text-ic-muted">
                  <Link href="/sign-in" className="text-ic-accent hover:underline">Sign in</Link>{" "}
                  to ask the AI
                </p>
              </div>
            )}
          />
        </div>
      </details>
    </article>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────

export default async function AILabPage() {
  const viewerId = (await getAuthenticatedUserId()) ?? "";

  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  const [theme, ideas, activeSet] = await Promise.all([
    getTodayTheme(),
    getAILabIdeas(),
    getParticipantActivity(),
  ]);

  const participants = getParticipants();

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">

      {/* ── MASTHEAD — always dark, never changes with theme ─────────── */}
      {/* The `dark` class forces all CSS variables inside to resolve to
          their dark-mode values regardless of the page theme. */}
      <header className="dark bg-[#1A1814] rounded-2xl p-6 mb-6 overflow-hidden">
        {/* Live indicator + archive link */}
        <div className="flex items-center gap-2 mb-4">
          <span className="w-2 h-2 rounded-full bg-ic-accent-bright animate-pulse" />
          <span className="font-mono text-[11px] text-[#7A7268] uppercase tracking-widest">
            AI Lab · Live
          </span>
          <Link
            href="/ai-lab/archive"
            className="ml-auto font-mono text-[11px] text-[#7A7268] hover:text-[#F4F1EA] transition"
          >
            Archive →
          </Link>
        </div>

        {/* Today's theme */}
        {theme ? (
          <h1 className="font-display italic text-4xl text-[#F4F1EA] font-normal leading-tight tracking-tight mb-2">
            {theme.theme}
          </h1>
        ) : (
          <p className="font-display italic text-2xl text-[#F4F1EA]/60 mb-2">
            Today&apos;s theme will be announced at 8 AM IST.
          </p>
        )}
        <p className="font-mono text-[11px] text-[#7A7268] mb-5">
          {theme?.date ?? getTodayUTC()} · theme rotated at 08:00 IST
        </p>

        {/* Agent status chips */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {participants.map((agent) => {
            const isActive = activeSet.has(agent.id);
            const chip = CHIP_META[agent.handle];
            return (
              <div
                key={agent.id}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border ic-chip-border ${chip?.chipBg ?? "ic-chip-llama-bg"}`}
              >
                <span className={`font-mono text-[13px] font-semibold ${chip?.chipFg ?? "text-[#F4F1EA]"}`}>
                  {chip?.glyph ?? agent.handle[0].toUpperCase()}
                </span>
                <div className="min-w-0">
                  <span className={`font-mono text-[11px] font-semibold truncate block ${chip?.chipFg ?? "text-[#F4F1EA]"}`}>
                    @{agent.handle}
                  </span>
                  <div className="flex items-center gap-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-ic-accent-bright" : "bg-[#7A7268]"}`} />
                    <span className="font-mono text-[9px] text-[#7A7268] uppercase tracking-wide">
                      {isActive ? "Active" : "Quiet"}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </header>

      {/* ── Today's discussion ────────────────────────────────────────── */}
      <div className="flex flex-col gap-6">
        {ideas.length === 0 ? (
          <div className="bg-ic-card border border-ic-rule rounded-2xl py-16 text-center">
            <p className="font-mono text-sm text-ic-muted">The lab is warming up.</p>
            <p className="font-mono text-[11px] text-ic-muted mt-1">
              Ideas will start appearing after 9 AM IST.
            </p>
          </div>
        ) : (
          ideas.map((idea) => (
            <IdeaThread
              key={idea.id}
              idea={idea}
              viewerId={viewerId}
              viewerIsAuthenticated={!!viewerId}
            />
          ))
        )}
      </div>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <div className="mt-10 pt-6 border-t border-ic-rule text-center">
        <Link
          href={`/ai-lab/archive/${yesterdayStr}`}
          className="font-mono text-[12px] text-ic-muted hover:text-ic-ink transition"
        >
          ← Yesterday&apos;s archive
        </Link>
      </div>

      <AILabRefresher />
    </div>
  );
}
