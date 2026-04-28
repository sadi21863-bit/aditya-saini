import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import ReactMarkdown from "react-markdown";
import {
  getWeeklyRollup,
  getAdjacentWeeklyRollups,
  getDailyArchivesInRange,
  stripMarkdown,
} from "@/lib/archive-queries";

type Params = { date: string };

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function formatDateRange(start: string, end: string): string {
  const [sy, sm, sd] = start.split("-").map(Number);
  const [ey, em, ed] = end.split("-").map(Number);
  const s = new Date(sy, sm - 1, sd);
  const e = new Date(ey, em - 1, ed);
  const opts: Intl.DateTimeFormatOptions = { month: "long", day: "numeric" };
  return `${s.toLocaleDateString("en-US", opts)} – ${e.toLocaleDateString("en-US", { ...opts, year: "numeric" })}`;
}

const RESOLUTION_STYLES: Record<string, string> = {
  unresolved:    "bg-amber-900/50 text-amber-300 border border-amber-700",
  converged:     "bg-green-900/50 text-green-300 border border-green-700",
  one_persuaded: "bg-blue-900/50 text-blue-300 border border-blue-700",
};

export async function generateMetadata(
  { params }: { params: Promise<Params> }
): Promise<Metadata> {
  const { date } = await params;
  const rollup = await getWeeklyRollup(date);
  if (!rollup) return { title: "Weekly Rollup — AI Lab" };

  const description = stripMarkdown(rollup.narrativeArc ?? "").slice(0, 160);
  const indexable   = process.env.AI_LAB_ARCHIVE_INDEXABLE === "true";

  return {
    title:   `${rollup.title} — AI Lab`,
    description,
    robots:  indexable ? undefined : { index: false, follow: false },
    openGraph: {
      title:       rollup.title,
      description,
      type:        "article",
      publishedTime: rollup.publishedAt?.toISOString(),
    },
  };
}

export default async function WeeklyRollupPage({ params }: { params: Promise<Params> }) {
  const { date } = await params;
  const rollup   = await getWeeklyRollup(date);
  if (!rollup) notFound();

  const periodStart = String(rollup.periodStart);
  const periodEnd   = String(rollup.periodEnd);

  const [adjacent, dailyArchives] = await Promise.all([
    getAdjacentWeeklyRollups(date),
    getDailyArchivesInRange(periodStart, periodEnd),
  ]);

  const disagreements = (Array.isArray(rollup.keyDisagreements) ? rollup.keyDisagreements : []) as Array<Record<string, unknown>>;
  const quotes        = (Array.isArray(rollup.memorableQuotes)  ? rollup.memorableQuotes  : []) as Array<Record<string, unknown>>;
  const questions     = (Array.isArray(rollup.keyQuestions)     ? rollup.keyQuestions     : []) as string[];

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <Link href="/ai-lab/archive" className="inline-flex items-center gap-1.5 text-slate-400 hover:text-teal-400 text-sm mb-8 transition-colors">
        <ChevronLeft size={14} /> Back to archive
      </Link>

      {/* Hero */}
      <div className="mb-8">
        <p className="text-slate-400 text-sm mb-1">{formatDateRange(periodStart, periodEnd)}</p>
        <h1 className="text-3xl font-bold text-white leading-tight mb-1">{rollup.title}</h1>
        <p className="text-teal-400 text-sm font-medium">Weekly Roundup</p>
      </div>

      {/* Narrative */}
      {rollup.narrativeArc && (
        <section className="mb-10">
          <h2 className="text-lg font-semibold text-white mb-4">Week in Review</h2>
          <article className="text-slate-100 leading-relaxed space-y-4 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-teal-400 [&_h2]:mt-6 [&_h2]:mb-2 [&_strong]:text-white [&_em]:text-slate-300 [&_p]:text-slate-200">
            <ReactMarkdown>{rollup.narrativeArc ?? ""}</ReactMarkdown>
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
                {q.context && <p className="text-slate-500 text-xs italic mt-1">{String(q.context)}</p>}
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
                <span className="text-teal-500 shrink-0 mt-0.5">•</span><span>{q}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Daily archives this week */}
      {dailyArchives.length > 0 && (
        <section className="mb-10">
          <details className="group">
            <summary className="flex items-center gap-2 text-slate-400 hover:text-white text-sm font-medium cursor-pointer list-none transition-colors">
              <ChevronRight size={14} className="group-open:rotate-90 transition-transform" />
              Daily archives this week ({dailyArchives.length})
            </summary>
            <ul className="mt-3 flex flex-col gap-2 pl-5">
              {dailyArchives.map((a) => (
                <li key={String(a.date)} className="text-sm">
                  <Link href={`/ai-lab/archive/${String(a.date)}`} className="text-teal-400 hover:text-teal-300 transition-colors">
                    {formatDate(String(a.date))}
                  </Link>
                  <span className="text-slate-500 ml-2">— {a.theme}</span>
                </li>
              ))}
            </ul>
          </details>
        </section>
      )}

      {/* Footer nav */}
      <div className="border-t border-slate-800 pt-8 flex items-center justify-between gap-4">
        {adjacent.prev ? (
          <Link href={`/ai-lab/archive/weekly/${adjacent.prev}`} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 text-sm font-semibold transition-colors">
            <ChevronLeft size={14} /> Previous week
          </Link>
        ) : <div />}
        <Link href="/ai-lab/archive" className="text-slate-500 hover:text-slate-300 text-sm transition-colors">Archive index</Link>
        {adjacent.next ? (
          <Link href={`/ai-lab/archive/weekly/${adjacent.next}`} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 text-sm font-semibold transition-colors">
            Next week <ChevronRight size={14} />
          </Link>
        ) : <div />}
      </div>
    </div>
  );
}
