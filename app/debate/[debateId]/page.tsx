import type { Metadata } from "next";
import { db }           from "@/db";
import { quickDebates } from "@/db/schema";
import { eq }           from "drizzle-orm";
import { notFound }     from "next/navigation";
import Link             from "next/link";
import ReactMarkdown    from "react-markdown";
import DebatePoller     from "@/components/debate/DebatePoller";
import { ShareButton }  from "@/components/ShareButton";

type Params = { debateId: string };

export async function generateMetadata(
  { params }: { params: Promise<Params> }
): Promise<Metadata> {
  const { debateId } = await params;
  const [debate] = await db
    .select({ ideaText: quickDebates.ideaText, status: quickDebates.status })
    .from(quickDebates)
    .where(eq(quickDebates.id, debateId))
    .limit(1);

  if (!debate) return { title: "Debate — IdeaConnect" };

  const title = debate.ideaText.slice(0, 60);
  return {
    title:  `${title} — IdeaConnect Debate`,
    robots: { index: true, follow: true },
  };
}

export default async function DebatePage(
  { params }: { params: Promise<Params> }
) {
  const { debateId } = await params;

  const [debate] = await db
    .select()
    .from(quickDebates)
    .where(eq(quickDebates.id, debateId))
    .limit(1);

  if (!debate) notFound();

  return (
    <main className="max-w-3xl mx-auto px-6 py-12">

      {/* Back link */}
      <Link
        href="/debate/new"
        className="inline-flex items-center gap-1 font-mono text-[12px] text-ic-muted hover:text-ic-ink transition-colors mb-8"
      >
        ← New debate
      </Link>

      {/* Idea heading */}
      <h1 className="font-display text-3xl font-normal tracking-tight text-ic-ink mb-2 leading-snug">
        {debate.ideaText}
      </h1>
      <p className="font-mono text-[11px] text-ic-muted mb-8">
        @llama vs @gpt-oss · Quick Debate
      </p>

      {/* Complete: show narrative + share button */}
      {debate.status === "complete" && debate.narrativeArc ? (
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
              [&_strong]:font-sans [&_strong]:font-semibold [&_strong]:text-ic-ink
              [&_p]:text-ic-ink">
              <ReactMarkdown>{debate.narrativeArc}</ReactMarkdown>
            </article>
          </div>

          {/* Share row */}
          <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-ic-rule">
            <ShareButton />
            <Link
              href="/debate/new"
              className="px-4 py-2 rounded-lg text-sm text-ic-muted hover:text-ic-ink transition font-mono"
            >
              Debate another idea →
            </Link>
          </div>
        </>
      ) : debate.status === "failed" ? (
        <div>
          <p className="text-red-500 text-sm font-mono mb-4">
            Debate failed: {debate.errorMessage ?? "Unknown error"}
          </p>
          <Link
            href="/debate/new"
            className="px-4 py-2 rounded-lg border border-ic-rule text-sm text-ic-ink
                       hover:bg-ic-paper-deep transition font-mono"
          >
            Try again →
          </Link>
        </div>
      ) : (
        /* In progress: poll for updates */
        <DebatePoller
          debateId={debate.id}
          currentStatus={debate.status}
          createdAt={debate.createdAt}
        />
      )}

    </main>
  );
}
