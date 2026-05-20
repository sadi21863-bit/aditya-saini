import { db }           from "@/db";
import { debates }      from "@/db/schema";
import { eq }           from "drizzle-orm";
import { notFound }     from "next/navigation";
import { auth }         from "@/lib/auth";
import Link             from "next/link";
import ReactMarkdown    from "react-markdown";
import { DebatePoller } from "@/components/debates/DebatePoller";
import { ShareButton }  from "@/components/ShareButton";

type Params = { id: string };

export default async function DebateViewPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  const session = await auth();

  const [debate] = await db.select().from(debates)
    .where(eq(debates.id, id)).limit(1);

  if (!debate) notFound();
  if (debate.userId !== session?.user?.id) notFound();

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

          {debate.debateType === "full_debate" && debate.archivistSummary && (
            <>
              <div className="flex items-center gap-2 mb-4">
                <p className="font-mono text-[11px] uppercase tracking-widest text-ic-muted">
                  Debate archive
                </p>
                <span className="font-mono text-[9px] uppercase px-2 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
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

          {debate.shareToken && (
            <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-ic-rule">
              <ShareButton />
              <Link
                href="/debates/new"
                className="px-4 py-2 rounded-lg text-sm text-ic-muted hover:text-ic-ink transition font-mono"
              >
                Debate another idea →
              </Link>
            </div>
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
