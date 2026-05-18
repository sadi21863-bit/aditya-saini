import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Lightbulb, MessageSquare, Users } from "lucide-react";
import {
  getArchiveIndex,
  getArchiveIndexCount,
  getRollupIndex,
  getRollupIndexCount,
  stripMarkdown,
  ARCHIVE_PAGE_SIZE,
} from "@/lib/archive-queries";

export const metadata: Metadata = {
  title: "AI Lab Archive — IdeaConnect",
  description: "Every day's AI Lab discussion, permanently recorded.",
  robots: process.env.AI_LAB_ARCHIVE_INDEXABLE === "true" ? undefined : { index: false, follow: false },
};

type Props = {
  searchParams: Promise<{ tab?: string; page?: string }>;
};

const TABS = ["daily", "weekly", "monthly"] as const;
type Tab = typeof TABS[number];

function formatDate(dateStr: string): string {
  const [y, m, d] = String(dateStr).split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatDateRange(start: string, end: string): string {
  const [sy, sm, sd] = String(start).split("-").map(Number);
  const [ey, em, ed] = String(end).split("-").map(Number);
  const s = new Date(sy, sm - 1, sd);
  const e = new Date(ey, em - 1, ed);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${s.toLocaleDateString("en-US", opts)} – ${e.toLocaleDateString("en-US", { ...opts, year: "numeric" })}`;
}

const EMPTY_MSG = "No published archives yet. Archives generate nightly — check back tomorrow.";

export default async function ArchiveIndexPage({ searchParams }: Props) {
  const { tab: tabParam, page: pageParam } = await searchParams;
  const tab  = (TABS.includes(tabParam as Tab) ? tabParam : "daily") as Tab;
  const page = Math.max(1, Number(pageParam ?? 1));

  function buildUrl(p: number, t: Tab = tab) {
    const params = new URLSearchParams();
    if (t !== "daily") params.set("tab", t);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return `/ai-lab/archive${qs ? `?${qs}` : ""}`;
  }

  // Fetch data for the active tab
  let items: unknown[] = [];
  let totalCount = 0;

  if (tab === "daily") {
    [items, totalCount] = await Promise.all([
      getArchiveIndex(page),
      getArchiveIndexCount(),
    ]);
  } else {
    const pType = tab === "weekly" ? "weekly" : "monthly";
    [items, totalCount] = await Promise.all([
      getRollupIndex(pType, page),
      getRollupIndexCount(pType),
    ]);
  }

  const totalPages = Math.ceil(totalCount / ARCHIVE_PAGE_SIZE);

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">

      {/* Header */}
      <div className="mb-8">
        <p className="font-mono text-[11px] uppercase tracking-widest text-ic-muted mb-2">
          AI Lab
        </p>
        <h1 className="font-display text-4xl font-normal tracking-tight text-ic-ink">Archive</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-ic-rule mb-8">
        {TABS.map((t) => (
          <Link
            key={t}
            href={buildUrl(1, t)}
            className={`shrink-0 pb-3 font-mono text-[12px] font-medium capitalize transition-colors ${
              tab === t
                ? "border-b-2 border-ic-ink text-ic-ink -mb-px"
                : "text-ic-muted hover:text-ic-ink-soft"
            }`}
          >
            {t}
          </Link>
        ))}
      </div>

      {/* Archive list */}
      {items.length === 0 ? (
        <p className="font-mono text-sm text-ic-muted text-center py-20">{EMPTY_MSG}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {tab === "daily" && (items as Array<Record<string, unknown>>).map((archive) => {
            const date        = String(archive.date ?? "");
            const theme       = String(archive.theme ?? "");
            const excerpt     = stripMarkdown(String(archive.narrativeArc ?? "")).slice(0, 120);
            const stats       = (archive.stats ?? {}) as Record<string, number>;

            return (
              <Link
                key={String(archive.id)}
                href={`/ai-lab/archive/${date}`}
                className="block bg-ic-card border border-ic-rule rounded-2xl p-5 hover:border-ic-accent transition-colors"
              >
                <div className="flex items-start justify-between gap-4 mb-2">
                  <span className="font-mono text-[11px] text-ic-muted">{formatDate(date)}</span>
                  <div className="flex items-center gap-3 shrink-0">
                    {[
                      { icon: <Lightbulb size={11} />,    v: stats.ideas_count        ?? 0 },
                      { icon: <MessageSquare size={11} />, v: stats.comments_count     ?? 0 },
                      { icon: <Users size={11} />,         v: stats.participants_active ?? 0 },
                    ].map(({ icon, v }, i) => (
                      <span key={i} className="flex items-center gap-1 font-mono text-[11px] text-ic-muted">
                        <span className="text-ic-accent">{icon}</span>{v}
                      </span>
                    ))}
                  </div>
                </div>
                <h3 className="font-display italic text-ic-ink mb-1 leading-snug">{theme}</h3>
                {excerpt && <p className="text-ic-ink-soft text-xs leading-relaxed line-clamp-2">{excerpt}</p>}
              </Link>
            );
          })}

          {tab !== "daily" && (items as Array<Record<string, unknown>>).map((rollup) => {
            const start   = String(rollup.periodStart ?? "");
            const end     = String(rollup.periodEnd   ?? "");
            const title   = String(rollup.title ?? "");
            const excerpt = stripMarkdown(String(rollup.narrativeArc ?? "")).slice(0, 120);
            const href    = tab === "weekly"
              ? `/ai-lab/archive/weekly/${end}`
              : `/ai-lab/archive/monthly/${start.slice(0, 7)}`;

            return (
              <Link
                key={String(rollup.id)}
                href={href}
                className="block bg-ic-card border border-ic-rule rounded-2xl p-5 hover:border-ic-accent transition-colors"
              >
                <p className="font-mono text-[11px] text-ic-muted mb-1">{formatDateRange(start, end)}</p>
                <h3 className="font-display italic text-ic-ink mb-1 leading-snug">{title}</h3>
                {excerpt && <p className="text-ic-ink-soft text-xs leading-relaxed line-clamp-2">{excerpt}</p>}
              </Link>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-10">
          {page > 1 ? (
            <Link href={buildUrl(page - 1)} className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-ic-rule text-ic-muted hover:border-ic-ink hover:text-ic-ink font-mono text-xs transition-colors">
              <ChevronLeft size={13} /> Previous
            </Link>
          ) : (
            <span className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-ic-rule-soft text-ic-muted/50 font-mono text-xs cursor-not-allowed">
              <ChevronLeft size={13} /> Previous
            </span>
          )}
          <span className="font-mono text-xs text-ic-muted">
            Page <span className="text-ic-ink font-semibold">{page}</span> of{" "}
            <span className="text-ic-ink font-semibold">{totalPages}</span>
          </span>
          {page < totalPages ? (
            <Link href={buildUrl(page + 1)} className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-ic-rule text-ic-muted hover:border-ic-ink hover:text-ic-ink font-mono text-xs transition-colors">
              Next <ChevronRight size={13} />
            </Link>
          ) : (
            <span className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-ic-rule-soft text-ic-muted/50 font-mono text-xs cursor-not-allowed">
              Next <ChevronRight size={13} />
            </span>
          )}
        </div>
      )}
    </div>
  );
}
