import type { Metadata }  from "next";
import { notFound }       from "next/navigation";
import Link               from "next/link";
import ReactMarkdown      from "react-markdown";
import Image              from "next/image";
import {
  getDebateByShareToken,
  getDebateParticipants,
  getDebateTurns,
} from "@/lib/agents/debate-helpers";
import { getAgent }       from "@/lib/agents/personas";

type Params = { token: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { token } = await params;
  const debate = await getDebateByShareToken(token);
  if (!debate) return {};
  return {
    title:       `"${debate.title.slice(0, 60)}" — Quick Debate on IdeaConnect`,
    description: debate.archivistSummary?.slice(0, 155) ?? "",
    openGraph: {
      title:       `AI Debate: ${debate.title.slice(0, 60)}`,
      description: debate.archivistSummary?.slice(0, 155) ?? "",
      images: [
        `${process.env.NEXT_PUBLIC_APP_URL}/api/og?title=${encodeURIComponent(debate.title.slice(0, 60))}&type=debate`,
      ],
    },
    robots: "index, follow",
  };
}

export default async function PublicArchivePage({ params }: { params: Promise<Params> }) {
  const { token } = await params;
  const debate = await getDebateByShareToken(token);
  if (!debate || debate.status !== "archived") notFound();

  const participants = await getDebateParticipants(debate.id);
  const turns        = await getDebateTurns(debate.id);

  const agentDetails = participants.map(p => ({ ...p, agent: getAgent(p.agentId) }));

  return (
    <main className="max-w-3xl mx-auto px-6 py-12">
      <p className="font-mono text-[11px] uppercase tracking-widest text-ic-muted mb-3">
        Quick Debate · IdeaConnect
      </p>
      <h1 className="font-display text-3xl font-normal tracking-tight text-ic-ink mb-2 leading-snug">
        {debate.title}
      </h1>
      {debate.judgeReasoning && (
        <p className="text-ic-muted text-sm mb-8 italic">&ldquo;{debate.judgeReasoning}&rdquo;</p>
      )}

      {turns.map((turn) => {
        const participant = agentDetails.find(p => p.agentId === turn.agentId);
        return (
          <div key={turn.id} className="mb-6 flex gap-4">
            {participant?.agent?.avatar && (
              <Image
                src={participant.agent.avatar}
                alt={participant.agent.name}
                width={40}
                height={40}
                className="rounded-full w-10 h-10 flex-shrink-0 mt-1"
              />
            )}
            <div className="flex-1">
              <p className="font-mono text-[11px] text-ic-muted mb-1">
                @{participant?.agent?.handle ?? "agent"}
              </p>
              <p className="text-ic-ink text-base leading-relaxed">{turn.content}</p>
            </div>
          </div>
        );
      })}

      {debate.archivistSummary && (
        <div className="mt-8 p-6 bg-ic-paper-deep border border-ic-rule rounded-2xl">
          <div className="flex items-center gap-2 mb-3">
            <p className="font-mono text-[11px] uppercase tracking-widest text-ic-muted">Archive</p>
            <span className="font-mono text-[9px] uppercase px-2 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
              AI-generated
            </span>
          </div>
          <article className="font-display text-base leading-relaxed text-ic-ink space-y-4">
            <ReactMarkdown>{debate.archivistSummary}</ReactMarkdown>
          </article>
        </div>
      )}

      <div className="mt-12 pt-8 border-t border-ic-rule">
        <p className="text-ic-muted text-sm mb-3">Want AI agents to debate your idea?</p>
        <Link
          href="/debates/new"
          className="inline-block px-6 py-3 rounded-lg bg-ic-accent text-white text-sm
                     font-medium hover:opacity-90 transition"
        >
          Try it on IdeaConnect →
        </Link>
      </div>
    </main>
  );
}
