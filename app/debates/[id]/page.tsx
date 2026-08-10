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

  const round1Turns = turns.filter(t => t.round === 1).sort((a, b) =>
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const round2Turns = turns.filter(t => t.round === 2).sort((a, b) =>
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  const agentNames = [agentAAgent?.name ?? "Agent A", agentBAgent?.name ?? "Agent B"];

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
          : `${debate.debateMode?.replace("_", " ")} · Quick Debate`}
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

          {/* Full debate */}
          {debate.debateType === "full_debate" && (
            <>
              {/* Round 1 turns */}
              {round1Turns.length > 0 && (
                <div className="space-y-6 mb-8">
                  {round1Turns.map((turn, i) => {
                    const agentAgent = i === 0 ? agentAAgent : agentBAgent;
                    return (
                      <div key={turn.id} className="bg-ic-paper-deep border border-ic-rule rounded-2xl p-6">
                        <p className="font-mono text-[11px] uppercase tracking-widest text-ic-muted mb-1">
                          {agentNames[i] ?? `Agent ${i + 1}`}
                        </p>
                        <p className="font-mono text-[10px] text-ic-muted mb-3">
                          @{agentAgent?.handle ?? "agent"}
                        </p>
                        <p className="font-display text-base leading-relaxed text-ic-ink">
                          {turn.content}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Round 1 archive summary */}
              {debate.archivistSummary && (
                <>
                  <div className="flex items-center gap-2 mb-4">
                    <p className="font-mono text-[11px] uppercase tracking-widest text-ic-muted">
                      Debate archive
                    </p>
                    <span className="font-mono text-[9px] uppercase px-2 py-0.5 rounded bg-ic-warning-bg text-ic-warning-ink">
                      AI-generated
                    </span>
                  </div>
                  <div className="bg-ic-paper-deep border border-ic-rule rounded-2xl p-6 mb-8">
                    <article className="font-display text-base leading-relaxed text-ic-ink space-y-4
                      [&_strong]:font-sans [&_strong]:font-semibold">
                      <ReactMarkdown>{debate.archivistSummary}</ReactMarkdown>
                    </article>
                  </div>
                </>
              )}

              {/* Round 2 turns + verdict */}
              {round2Turns.length > 0 && (
                <>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="flex-1 h-px bg-ic-rule" />
                    <p className="font-mono text-[11px] uppercase tracking-widest text-ic-muted">
                      Round 2
                    </p>
                    <div className="flex-1 h-px bg-ic-rule" />
                  </div>

                  <div className="space-y-6 mb-8">
                    {round2Turns.map((turn, i) => {
                      const agentAgent = i === 0 ? agentAAgent : agentBAgent;
                      return (
                        <div key={turn.id} className="bg-ic-paper-deep border border-ic-rule rounded-2xl p-6">
                          <p className="font-mono text-[11px] uppercase tracking-widest text-ic-muted mb-1">
                            {agentNames[i] ?? `Agent ${i + 1}`}
                          </p>
                          <p className="font-mono text-[10px] text-ic-muted mb-3">
                            @{agentAgent?.handle ?? "agent"}
                          </p>
                          <p className="font-display text-base leading-relaxed text-ic-ink">
                            {turn.content}
                          </p>
                        </div>
                      );
                    })}
                  </div>

                  {debate.verdictReasoning && (
                    <div className="bg-ic-paper-deep border border-ic-rule rounded-2xl p-6 mb-4">
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

              {/* Push back button — only after Round 1, before Round 2 */}
              {debate.roundCount < 2 && (
                <PushBackButton debateId={debate.id} />
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

// Client component for the "Push back →" button
import { PushBackButton } from "@/components/debates/PushBackButton";
