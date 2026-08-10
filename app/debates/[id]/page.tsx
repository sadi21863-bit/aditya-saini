import { db }           from "@/db";
import { debates }      from "@/db/schema";
import { eq }           from "drizzle-orm";
import { notFound }     from "next/navigation";
import { auth }         from "@/lib/auth";
import Link             from "next/link";
import ReactMarkdown    from "react-markdown";
import { DebatePoller } from "@/components/debates/DebatePoller";
import { ShareButton }  from "@/components/ShareButton";
import { getDebateTurns, getDebateParticipants } from "@/lib/agents/debate-helpers";
import { getAgent }     from "@/lib/agents/personas";
import EmailSaveCard    from "@/components/debates/EmailSaveCard";
import { DebateRound }  from "@/components/debates/DebateRound";
import { PushbackInput } from "@/components/debates/PushbackInput";
import { VerdictCard }  from "@/components/debates/VerdictCard";
import { RequestVerdictButton } from "@/components/debates/RequestVerdictButton";

type Params = { id: string };

export default async function DebateViewPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  const session = await auth();

  const [debate] = await db.select().from(debates)
    .where(eq(debates.id, id)).limit(1);

  if (!debate) notFound();
  if (debate.userId !== session?.user?.id) notFound();
  const isAuthenticated = !!session?.user?.id;

  const turns        = debate.status !== "in_progress" ? await getDebateTurns(id) : [];
  const participants = turns.length > 0 ? await getDebateParticipants(id) : [];

  const agentAAgent = getAgent(participants[0]?.agentId ?? "");
  const agentBAgent = getAgent(participants[1]?.agentId ?? "");
  const agentNames = [agentAAgent?.name ?? "Agent A", agentBAgent?.name ?? "Agent B"];

  // Group turns by round
  const turnsByRound = new Map<number, typeof turns>();
  for (const turn of turns) {
    const round = turn.round ?? 1;
    if (!turnsByRound.has(round)) turnsByRound.set(round, []);
    turnsByRound.get(round)!.push(turn);
  }
  const rounds = Array.from(turnsByRound.entries()).sort(([a], [b]) => a - b);

  return (
    <main className="max-w-3xl mx-auto px-6 py-12">
      <Link
        href="/debates/history"
        className="inline-flex items-center gap-1 font-mono text-[11px] text-ic-muted
                   hover:text-ic-ink transition mb-8"
      >
        ← Debate history
      </Link>

      <h1 className="font-display text-3xl font-normal tracking-tight text-ic-ink mb-2 leading-snug">
        {debate.title}
      </h1>
      <p className="font-mono text-[11px] text-ic-muted mb-8">
        {debate.debateType === "quick_take"
          ? "Quick Take"
          : debate.debateMode?.replace("_", " ")}
        {debate.roundCount > 1 && ` · Round ${debate.roundCount}`}
      </p>

      {debate.status === "archived" ? (
        <>
          {/* Quick Take */}
          {debate.debateType === "quick_take" && debate.judgeAnswer && (
            <div className="bg-ic-paper-deep border border-ic-rule rounded-2xl p-6 mb-8">
              <p className="font-mono text-[11px] uppercase tracking-widest text-ic-muted mb-3">
                Judge&apos;s answer
              </p>
              <article className="font-display text-base leading-relaxed text-ic-ink">
                <ReactMarkdown>{debate.judgeAnswer}</ReactMarkdown>
              </article>
            </div>
          )}

          {/* Full debate — multi-round timeline */}
          {debate.debateType === "full_debate" && (
            <>
              {rounds.map(([roundNum, roundTurns]) => (
                <DebateRound
                  key={roundNum}
                  roundNumber={roundNum}
                  turns={roundTurns}
                />
              ))}

              {/* Verdict — shown for multi-round debates with a verdict */}
              {debate.verdict && (
                <VerdictCard
                  verdict={debate.verdict}
                  reasoning={debate.verdictReasoning}
                  winnerId={debate.winnerId}
                  roundCount={debate.roundCount}
                />
              )}

              {/* Email save — only for unauthenticated users */}
              {!isAuthenticated && debate.shareToken && (
                <EmailSaveCard debateId={debate.id} shareToken={debate.shareToken} />
              )}

              {/* Share + start new */}
              {debate.shareToken && (
                <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-ic-rule">
                  <ShareButton url={`${process.env.NEXT_PUBLIC_APP_URL}/debates/share/${debate.shareToken}`} />
                  <Link
                    href="/debates/new"
                    className="px-4 py-2 rounded-lg text-sm text-ic-muted hover:text-ic-ink transition font-mono"
                  >
                    Debate another idea →
                  </Link>
                </div>
              )}
            </>
          )}
        </>
      ) : debate.status === "awaiting_pushback" ? (
        <>
          {/* Show completed rounds */}
          {rounds.map(([roundNum, roundTurns]) => (
            <DebateRound
              key={roundNum}
              roundNumber={roundNum}
              turns={roundTurns}
            />
          ))}

          {/* Pushback input or verdict request */}
          {debate.roundCount < debate.maxRounds &&
           debate.pushbackCount < debate.maxPushbacks ? (
            <PushbackInput
              debateId={debate.id}
              roundCount={debate.roundCount}
              maxPushbacks={debate.maxPushbacks}
              pushbacksUsed={debate.pushbackCount}
            />
          ) : (
            <RequestVerdictButton debateId={debate.id} />
          )}
        </>
      ) : debate.status === "abandoned" ? (
        <div>
          <p className="text-ic-muted text-sm font-mono mb-4">This debate was abandoned.</p>
          <Link
            href="/debates/new"
            className="px-4 py-2 rounded-lg border border-ic-rule text-sm text-ic-ink
                       hover:bg-ic-paper-deep transition font-mono"
          >
            Start a new debate →
          </Link>
        </div>
      ) : (
        <DebatePoller
          debateId={debate.id}
          currentStatus={debate.status}
          createdAt={debate.createdAt}
        />
      )}
    </main>
  );
}
