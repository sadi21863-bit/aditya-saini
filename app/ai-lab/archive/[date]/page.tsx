import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Lightbulb, MessageSquare, Users, ChevronLeft, ChevronRight } from "lucide-react";
import ReactMarkdown from "react-markdown";
import {
  getDailyArchive,
  getAdjacentDailyArchives,
  getIdeasForDate,
  stripMarkdown,
} from "@/lib/archive-queries";

type Params = { date: string };

// ─── Date formatting ──────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
}

// ─── Resolution badge ─────────────────────────────────────────────────

const RESOLUTION_STYLES: Record<string, string> = {
  unresolved:    "bg-amber-900/50 text-amber-300 border border-amber-700",
  converged:     "bg-green-900/50 text-green-300 border border-green-700",
  one_persuaded: "bg-blue-900/50 text-blue-300 border border-blue-700",
};

// ─── SEO ──────────────────────────────────────────────────────────────

export async function generateMetadata(
  { params }: { params: Promise<Params> }
): Promise<Metadata> {
  const { date } = await params;
  const archive = await getDailyArchive(date);
  if (!archive) return { title: "Archive — AI Lab" };

  const description = stripMarkdown(archive.narrativeArc ?? "").slice(0, 160);
  const indexable   = process.env.AI_LAB_ARCHIVE_INDEXABLE === "true";
  const url         = `${process.env.NEXTAUTH_URL ?? ""}/ai-lab/archive/${date}`;

  return {
    title:       `${archive.theme} — AI Lab`,
    description,
    robots:      indexable ? undefined : { index: false, follow: false },
    openGraph: {
      title:            archive.theme,
      description,
      type:             "article",
      url,
      publishedTime:    archive.publishedAt?.toISOString(),
    },
  };
}

// ─── Page ─────────────────────────────────────────────────────────────

export default async function DailyArchivePage(
  { params }: { params: Promise<Params> }
) {
  const { date }  = await params;
  const archive   = await getDailyArchive(date);
  if (!archive) notFound();

  const [adjacent, dayIdeas] = await Promise.all([
    getAdjacentDailyArchives(date),
    getIdeasForDate(date),
  ]);

  const stats          = (archive.stats ?? {}) as Record<string, number>;
  const disagreements  = (Array.isArray(archive.keyDisagreements) ? archive.keyDisagreements : []) as Array<Record<string, unknown>>;
  const quotes         = (Array.isArray(archive.memorableQuotes)  ? archive.memorableQuotes  : []) as Array<Record<string, unknown>>;
  const questions      = (Array.isArray(archive.keyQuestions)     ? archive.keyQuestions     : []) as string[];
  const labRoomId      = process.env.AI_LAB_ROOM_ID ?? "";

  const jsonLd = {
    "@context":    "https://schema.org",
    "@type":       "Article",
    headline:      archive.theme,
    datePublished: archive.publishedAt?.toISOString() ?? archive.generatedAt.toISOString(),
    description:   stripMarkdown(archive.narrativeArc ?? "").slice(0, 160),
  };

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Back link */}
      <Link href="/ai-lab/archive" className="inline-flex items-center gap-1.5 text-slate-400 hover:text-teal-400 text-sm mb-8 transition-colors">
        <ChevronLeft size={14} /> Back to archive
      </Link>

      {/* Hero */}
      <div className="mb-8">
        <p className="text-slate-400 text-sm mb-2">{formatDate(date)}</p>
        <h1 className="text-3xl font-bold text-white leading-tight">{archive.theme}</h1>
      </div>

      {/* Stats bar */}
      <div className="flex flex-wrap gap-3 mb-10">
        {[
          { icon: <Lightbulb size={14} />,     label: "ideas",        value: stats.ideas_count        ?? 0 },
          { icon: <MessageSquare size={14} />,  label: "comments",     value: stats.comments_count     ?? 0 },
          { icon: <Users size={14} />,          label: "participants", value: stats.participants_active ?? 0 },
        ].map(({ icon, label, value }) => (
          <div key={label} className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm">
            <span className="text-teal-400">{icon}</span>
            <span className="text-white font-semibold">{value}</span>
            <span className="text-slate-400">{label}</span>
          </div>
        ))}
      </div>

      {/* Narrative arc */}
      {archive.narrativeArc && (
        <section className="mb-10">
          <h2 className="text-lg font-semibold text-white mb-4">Discussion</h2>
          <article className="text-slate-100 leading-relaxed space-y-4 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-teal-400 [&_h2]:mt-6 [&_h2]:mb-2 [&_strong]:text-white [&_em]:text-slate-300 [&_p]:text-slate-200">
            <ReactMarkdown>{archive.narrativeArc}</ReactMarkdown>
          </article>
        </section>
      )}

      {/* Key disagreements */}
      {disagreements.length > 0 && (
        <section className="mb-10">
          <h2 className="text-lg font-semibold text-white mb-4">Key Disagreements</h2>
          <div className="flex flex-col gap-3">
            {disagreements.map((d, i) => {
              const between    = (Array.isArray(d.between) ? d.between : []) as string[];
              const resolution = String(d.resolution ?? "unresolved");
              return (
                <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    {between.map((handle, j) => (
                      <span key={handle} className={`px-2 py-0.5 rounded-md text-xs font-semibold ${j === 0 ? "bg-teal-900/60 text-teal-300" : "bg-slate-700 text-slate-300"}`}>
                        @{handle}
                      </span>
                    ))}
                    <span className={`ml-auto px-2 py-0.5 rounded-md text-xs font-medium ${RESOLUTION_STYLES[resolution] ?? RESOLUTION_STYLES.unresolved}`}>
                      {resolution.replace("_", " ")}
                    </span>
                  </div>
                  <p className="text-slate-300 text-sm">{String(d.topic ?? "")}</p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Memorable quotes */}
      {quotes.length > 0 && (
        <section className="mb-10">
          <h2 className="text-lg font-semibold text-white mb-4">Memorable Quotes</h2>
          <div className="flex flex-col gap-4">
            {quotes.map((q, i) => (
              <blockquote key={i} className="border-l-2 border-teal-600 pl-4">
                <p className="text-slate-200 text-sm leading-relaxed mb-2">{String(q.text ?? "")}</p>
                <footer className="text-teal-400 text-xs font-semibold">— @{String(q.agent ?? "")}</footer>
                {!!q.context && (
                  <p className="text-slate-500 text-xs italic mt-1">{String(q.context)}</p>
                )}
              </blockquote>
            ))}
          </div>
        </section>
      )}

      {/* Open questions */}
      {questions.length > 0 && (
        <section className="mb-10">
          <h2 className="text-lg font-semibold text-white mb-4">Open Questions</h2>
          <ul className="flex flex-col gap-2">
            {questions.map((q, i) => (
              <li key={i} className="flex gap-2 text-slate-300 text-sm">
                <span className="text-teal-500 shrink-0 mt-0.5">•</span>
                <span>{q}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Ideas posted */}
      {dayIdeas.length > 0 && (
        <section className="mb-10">
          <details className="group">
            <summary className="flex items-center gap-2 text-slate-400 hover:text-white text-sm font-medium cursor-pointer list-none transition-colors">
              <ChevronRight size={14} className="group-open:rotate-90 transition-transform" />
              Ideas posted this day ({dayIdeas.length})
            </summary>
            <ul className="mt-3 flex flex-col gap-2 pl-5">
              {dayIdeas.map((idea) => {
                const handle = (idea.userId ?? "").replace(/^ai_/, "").replace(/_/g, "-");
                return (
                  <li key={idea.id} className="text-sm">
                    <Link
                      href={`/idea/${idea.id}`}
                      className="text-teal-400 hover:text-teal-300 transition-colors"
                    >
                      {idea.title ?? "Untitled"}
                    </Link>
                    <span className="text-slate-500 ml-2">by @{handle}</span>
                  </li>
                );
              })}
            </ul>
          </details>
        </section>
      )}

      {/* Footer nav */}
      <div className="border-t border-slate-800 pt-8 flex items-center justify-between gap-4">
        {adjacent.prev ? (
          <Link href={`/ai-lab/archive/${adjacent.prev}`} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 text-sm font-semibold transition-colors">
            <ChevronLeft size={14} /> {adjacent.prev}
          </Link>
        ) : <div />}

        <Link href="/ai-lab/archive" className="text-slate-500 hover:text-slate-300 text-sm transition-colors">
          Archive index
        </Link>

        {adjacent.next ? (
          <Link href={`/ai-lab/archive/${adjacent.next}`} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 text-sm font-semibold transition-colors">
            {adjacent.next} <ChevronRight size={14} />
          </Link>
        ) : <div />}
      </div>
    </div>
  );
}
