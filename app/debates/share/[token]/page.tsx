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
  const description = debate.verdict ?? debate.archivistSummary?.slice(0, 155) ?? "";
  return {
    title:       `"${debate.title.slice(0, 60)}" — Quick Debate on IdeaConnect`,
    description,
    openGraph: {
      title:       `AI Debate: ${debate.title.slice(0, 60)}`,
      description,
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
  const allTurns     = (await getDebateTurns(debate.id))
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  const agentDetails = participants.map(p => ({ ...p, agent: getAgent(p.agentId) }));

  const round1Turns = allTurns.filter(t => t.round === 1);
  const round2Turns = allTurns.filter(t => t.round === 2);

  function TurnBlock({ turn }: { turn: typeof allTurns[0] }) {
    const participant = agentDetails.find(p => p.agentId === turn.agentId);
    return (
      <div className="mb-6 flex gap-4">
        {participant?.agent?.avatar && (
          <Image
            src={participant.agent.avatar}
            alt={participant.agent.name}
            width={40}
            height={40}
            className="rounded-full w-10 h-10 shrink-0 mt-1"
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
  }

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

      {round1Turns.map(turn => <TurnBlock key={turn.id} turn={turn} />)}

      {debate.archivistSummary && (
        <div className="mt-8 p-6 bg-ic-paper-deep border border-ic-rule rounded-2xl mb-8">
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

      {round2Turns.length > 0 && (
        <>
          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 h-px bg-ic-rule" />
            <p className="font-mono text-[11px] uppercase tracking-widest text-ic-muted">Round 2</p>
            <div className="flex-1 h-px bg-ic-rule" />
          </div>

          {round2Turns.map(turn => <TurnBlock key={turn.id} turn={turn} />)}

          {debate.verdictReasoning && (
            <div className="mt-8 p-6 bg-ic-paper-deep border border-ic-rule rounded-2xl mb-4">
              <p className="font-mono text-[11px] uppercase tracking-widest text-ic-muted mb-3">
                Round 2 analysis
              </p>
              <p className="font-display text-base leading-relaxed text-ic-ink">
                {debate.verdictReasoning}
              </p>
            </div>
          )}

          {debate.verdict && (
            <div className="border-l-2 border-ic-accent pl-4 mb-8">
              <p className="font-mono text-[11px] uppercase tracking-widest text-ic-muted mb-1">
                Verdict
              </p>
              <p className="font-display text-base font-medium text-ic-ink">
                {debate.verdict}
              </p>
            </div>
          )}
        </>
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
