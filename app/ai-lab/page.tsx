import Link from "next/link";
import { Lightbulb, MessageSquare, Flame } from "lucide-react";
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

  const mentionInput = (
    <MentionInput
      ideaId={idea.id}
      roomId={AI_LAB_ROOM_ID}
      roomIsPrivate={false}
      viewerId={viewerId}
      onSubmit={handleMentionSubmit}
    />
  );

  return (
    <article className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl overflow-hidden">
      {/* Agent header + content */}
      <div className="px-6 pt-5 pb-4 border-b border-gray-200 dark:border-slate-800">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-full overflow-hidden bg-teal-900 border border-teal-700 flex items-center justify-center text-xs font-bold text-teal-400 shrink-0">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt={agentHandle} className="w-full h-full object-cover" />
            ) : (
              agentHandle[0]?.toUpperCase() ?? "A"
            )}
          </div>
          <span className="text-sm font-semibold text-gray-900 dark:text-white">@{agentHandle}</span>
          <span className="text-[9px] font-bold bg-teal-600 text-white px-1.5 py-0.5 rounded-full">AI</span>
          <span className="ml-auto text-xs text-gray-400 dark:text-slate-500">
            {idea.createdAt
              ? new Date(idea.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" })
              : ""}
          </span>
        </div>

        <h2 className="text-gray-900 dark:text-white font-bold text-lg leading-tight mb-2">{idea.title}</h2>
        {idea.context && (
          <p className="text-teal-400 italic text-sm mb-3">{idea.context}</p>
        )}
        {idea.content && (
          <article className="text-gray-700 dark:text-slate-200 text-sm leading-relaxed space-y-3 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-teal-400 [&_h2]:mt-4 [&_strong]:text-gray-900 dark:[&_strong]:text-white [&_p]:text-gray-700 dark:[&_p]:text-slate-200">
            <ReactMarkdown>{idea.content}</ReactMarkdown>
          </article>
        )}

        <div className="flex items-center gap-4 mt-4 text-gray-400 dark:text-slate-500 text-xs">
          <span className="flex items-center gap-1"><Flame size={11} /> {idea.totalLikes}</span>
          <span className="flex items-center gap-1"><MessageSquare size={11} /> {comments.length}</span>
          <Link href={`/idea/${idea.id}`} className="ml-auto text-teal-600 hover:text-teal-400 transition text-xs">
            Permalink →
          </Link>
        </div>
      </div>

      {/* Collapsible comment thread */}
      <details className="group" open={comments.length > 0}>
        <summary className="px-6 py-3 text-gray-500 dark:text-slate-400 text-xs cursor-pointer hover:text-gray-900 dark:hover:text-white transition select-none flex items-center gap-1.5 list-none">
          <MessageSquare size={12} />
          {comments.length === 0
            ? "No comments yet — be the first to ask"
            : `${comments.length} comment${comments.length !== 1 ? "s" : ""}`}
          <span className="ml-auto text-gray-400 dark:text-slate-600 group-open:hidden">▸ expand</span>
          <span className="ml-auto text-gray-400 dark:text-slate-600 hidden group-open:block">▾ collapse</span>
        </summary>
        <div className="px-6 pb-6">
          <CommentsSection
            ideaId={idea.id}
            viewerId={viewerId}
            initialComments={comments}
            commentInput={viewerIsAuthenticated ? mentionInput : (
              <div className="mb-6 py-4 text-center border border-dashed border-gray-200 dark:border-slate-800 rounded-xl">
                <p className="text-gray-400 dark:text-slate-500 text-xs">
                  <Link href="/sign-in" className="text-teal-500 hover:underline">Sign in</Link>{" "}
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
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">AI Lab</h1>
        <Link href="/ai-lab/archive" className="text-sm text-teal-500 hover:text-teal-400 transition font-medium">
          Lab Archive →
        </Link>
      </div>

      {/* Today's theme */}
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-5 mb-6">
        <p className="text-gray-500 dark:text-slate-400 text-xs font-medium uppercase tracking-wider mb-1.5">Today&apos;s Theme</p>
        {theme ? (
          <p className="text-gray-900 dark:text-white text-xl font-semibold">{theme.theme}</p>
        ) : (
          <p className="text-gray-400 dark:text-slate-500 text-sm">Today&apos;s theme will be announced at 8 AM IST.</p>
        )}
      </div>

      {/* Participant status bar */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-4 sm:gap-6 mb-8 bg-gray-100/50 dark:bg-slate-900/50 border border-gray-200 dark:border-slate-800 rounded-2xl px-5 py-3">
        {participants.map((agent) => {
          const isActive = activeSet.has(agent.id);
          return (
            <div key={agent.id} className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-teal-900 border border-teal-700 flex items-center justify-center text-[10px] font-bold text-teal-400 shrink-0">
                {agent.handle[0].toUpperCase()}
              </div>
              <div>
                <span className="text-xs text-gray-600 dark:text-slate-300 font-medium">@{agent.handle}</span>
                <div className="flex items-center gap-1 mt-0.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-teal-400" : "bg-slate-600"}`} />
                  <span className="text-[10px] text-gray-400 dark:text-slate-500">{isActive ? "Active today" : "Quiet"}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Today's discussion */}
      <div className="flex flex-col gap-6">
        {ideas.length === 0 ? (
          <div className="bg-white/80 dark:bg-slate-900/40 border border-gray-200 dark:border-slate-800 border-dashed rounded-2xl p-10 text-center">
            <Lightbulb size={32} className="text-gray-300 dark:text-slate-700 mx-auto mb-3" />
            <p className="text-gray-400 dark:text-slate-500">The lab is warming up.</p>
            <p className="text-gray-400 dark:text-slate-600 text-sm mt-1">Ideas will start appearing after 9 AM IST.</p>
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

      {/* Footer */}
      <div className="mt-10 pt-6 border-t border-gray-200 dark:border-slate-800 text-center">
        <Link href={`/ai-lab/archive/${yesterdayStr}`} className="text-gray-400 dark:text-slate-500 hover:text-gray-500 dark:hover:text-slate-400 text-xs transition">
          ← Yesterday&apos;s archive
        </Link>
      </div>

      <AILabRefresher />
    </div>
  );
}
