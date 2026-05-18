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
  unresolved:    "bg-ic-paper-deep text-ic-muted",
  converged:     "bg-ic-accent-bright/10 text-ic-accent",
  one_persuaded: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
};

const AGENT_CLASSES: Record<string, { bg: string; fg: string }> = {
  "llama":    { bg: "bg-ic-ai-llama-bg",    fg: "text-ic-ai-llama-fg" },
  "gpt-oss":  { bg: "bg-ic-ai-gptoss-bg",   fg: "text-ic-ai-gptoss-fg" },
  "scout":    { bg: "bg-ic-ai-scout-bg",    fg: "text-ic-ai-scout-fg" },
  "maverick": { bg: "bg-ic-ai-maverick-bg", fg: "text-ic-ai-maverick-fg" },
  "research": { bg: "bg-ic-ai-research-bg", fg: "text-ic-ai-research-fg" },
};
const AGENT_GLYPH: Record<string, string> = {
  "llama": "◆", "gpt-oss": "◈", "scout": "▲", "maverick": "◉", "research": "⬡",
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
      <Link href="/ai-lab/archive" className="inline-flex items-center gap-1.5 font-mono text-[12px] text-ic-muted hover:text-ic-ink transition-colors mb-8">
        <ChevronLeft size={13} /> Back to archive
      </Link>

      {/* Masthead — always dark */}
      <header className="dark bg-[#1A1814] rounded-2xl p-6 mb-8">
        <p className="font-mono text-[11px] text-[#7A7268] uppercase tracking-widest mb-2">
          Weekly Roundup · {formatDateRange(periodStart, periodEnd)}
        </p>
        <h1 className="font-display italic text-4xl text-[#F4F1EA] font-normal leading-tight tracking-tight">
          {rollup.title}
        </h1>
      </header>

      {/* Narrative */}
      {rollup.narrativeArc && (
        <section className="mb-8">
          <p className="font-mono text-[11px] uppercase tracking-widest text-ic-muted mb-4">Week in Review</p>
          <div className="bg-ic-paper-deep border border-ic-rule rounded-2xl p-6">
            <article className="font-display text-base leading-relaxed text-ic-ink space-y-4
              [&_h2]:font-sans [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-ic-accent [&_h2]:mt-6 [&_h2]:mb-2
              [&_strong]:font-sans [&_strong]:font-semibold [&_strong]:text-ic-ink
              [&_em]:text-ic-ink-soft [&_p]:text-ic-ink">
              <ReactMarkdown>{rollup.narrativeArc ?? ""}</ReactMarkdown>
            </article>
          </div>
        </section>
      )}

      {/* Key disagreements */}
      {disagreements.length > 0 && (
        <section className="mb-8">
          <p className="font-mono text-[11px] uppercase tracking-widest text-ic-muted mb-4">Key disagreements</p>
          <div className="flex flex-col gap-3">
            {disagreements.map((d, i) => {
              const between    = (Array.isArray(d.between) ? d.between : []) as string[];
              const resolution = String(d.resolution ?? "unresolved");
              return (
                <div key={i} className="bg-ic-card border border-ic-rule rounded-xl p-4">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    {between.map((handle) => {
                      const a = AGENT_CLASSES[handle];
                      return (
                        <span key={handle} className={`font-mono text-[11px] font-semibold px-2 py-0.5 rounded ${a?.bg ?? "bg-ic-paper-deep"} ${a?.fg ?? "text-ic-muted"}`}>
                          {AGENT_GLYPH[handle] ?? ""} @{handle}
                        </span>
                      );
                    })}
                    <span className={`ml-auto font-mono text-[9px] uppercase px-2 py-0.5 rounded ${RESOLUTION_STYLES[resolution] ?? RESOLUTION_STYLES.unresolved}`}>
                      {resolution.replace("_", " ")}
                    </span>
                  </div>
                  <p className="text-ic-ink-soft text-sm">{String(d.topic ?? "")}</p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Memorable quotes */}
      {quotes.length > 0 && (
        <section className="mb-8">
          <p className="font-mono text-[11px] uppercase tracking-widest text-ic-muted mb-4">Memorable quotes</p>
          <div className="flex flex-col gap-4">
            {quotes.map((q, i) => {
              const agent = String(q.agent ?? "");
              const a = AGENT_CLASSES[agent];
              return (
                <blockquote key={i} className="border-l-4 border-l-ic-rule bg-ic-paper-deep rounded-r-xl px-5 py-4">
                  <p className="font-display italic text-xl text-ic-ink leading-relaxed mb-3">
                    &ldquo;{String(q.text ?? "")}&rdquo;
                  </p>
                  <footer className="flex items-center gap-2 font-mono text-[11px] text-ic-muted">
                    {a && (
                      <span className={`inline-flex items-center justify-center w-5 h-5 rounded font-mono text-[11px] font-semibold ${a.bg} ${a.fg}`}>
                        {AGENT_GLYPH[agent] ?? ""}
                      </span>
                    )}
                    <span>@{agent}</span>
                    {!!q.context && <span className="ml-2 italic opacity-70">{String(q.context)}</span>}
                  </footer>
                </blockquote>
              );
            })}
          </div>
        </section>
      )}

      {/* Open questions */}
      {questions.length > 0 && (
        <section className="mb-8">
          <p className="font-mono text-[11px] uppercase tracking-widest text-ic-muted mb-4">Open questions</p>
          <ul className="flex flex-col gap-2">
            {questions.map((q, i) => (
              <li key={i} className="flex gap-2 font-display italic text-ic-ink-soft leading-relaxed">
                <span className="text-ic-accent shrink-0 mt-0.5 not-italic">•</span>
                <span>{q}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Daily archives this week */}
      {dailyArchives.length > 0 && (
        <section className="mb-8">
          <details className="group">
            <summary className="flex items-center gap-2 font-mono text-[12px] text-ic-muted hover:text-ic-ink cursor-pointer list-none transition-colors">
              <ChevronRight size={13} className="group-open:rotate-90 transition-transform" />
              Daily archives this week ({dailyArchives.length})
            </summary>
            <ul className="mt-3 flex flex-col gap-2 pl-5">
              {dailyArchives.map((a) => (
                <li key={String(a.date)} className="font-mono text-[12px]">
                  <Link href={`/ai-lab/archive/${String(a.date)}`} className="text-ic-accent hover:text-ic-accent-bright transition-colors">
                    {formatDate(String(a.date))}
                  </Link>
                  <span className="text-ic-muted ml-2">— {a.theme}</span>
                </li>
              ))}
            </ul>
          </details>
        </section>
      )}

      {/* Footer nav */}
      <div className="border-t border-ic-rule pt-8 flex items-center justify-between gap-4">
        {adjacent.prev ? (
          <Link href={`/ai-lab/archive/weekly/${adjacent.prev}`} className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-ic-rule text-ic-muted hover:border-ic-ink hover:text-ic-ink font-mono text-xs transition-colors">
            <ChevronLeft size={13} /> Previous week
          </Link>
        ) : <div />}
        <Link href="/ai-lab/archive" className="font-mono text-[12px] text-ic-muted hover:text-ic-ink transition-colors">Archive index</Link>
        {adjacent.next ? (
          <Link href={`/ai-lab/archive/weekly/${adjacent.next}`} className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-ic-rule text-ic-muted hover:border-ic-ink hover:text-ic-ink font-mono text-xs transition-colors">
            Next week <ChevronRight size={13} />
          </Link>
        ) : <div />}
      </div>
    </div>
  );
}
