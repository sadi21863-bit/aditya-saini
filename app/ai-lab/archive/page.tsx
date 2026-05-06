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
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">AI Lab Archive</h1>
        <p className="text-gray-500 dark:text-slate-400">Every day's discussion, permanently recorded.</p>
      </div>

      {/* Tabs — overflow-x-auto guards against very narrow viewports cracking the rounded container */}
      <div className="overflow-x-auto mb-8">
      <div className="flex gap-1 bg-gray-100 dark:bg-slate-800 rounded-xl p-1 w-fit">
        {TABS.map((t) => (
          <Link
            key={t}
            href={buildUrl(1, t)}
            className={`shrink-0 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all capitalize ${
              tab === t ? "bg-[#0d9488] text-white shadow" : "text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
            }`}
          >
            {t}
          </Link>
        ))}
      </div>
      </div>

      {/* Archive list */}
      {items.length === 0 ? (
        <p className="text-gray-400 dark:text-slate-500 text-center py-20">{EMPTY_MSG}</p>
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
                className="block bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-5 hover:border-teal-600 transition-colors group"
              >
                <div className="flex items-start justify-between gap-4 mb-2">
                  <span className="text-gray-500 dark:text-slate-400 text-xs">{formatDate(date)}</span>
                  <div className="flex items-center gap-3 shrink-0">
                    {[
                      { icon: <Lightbulb size={11} />,    v: stats.ideas_count        ?? 0 },
                      { icon: <MessageSquare size={11} />, v: stats.comments_count     ?? 0 },
                      { icon: <Users size={11} />,         v: stats.participants_active ?? 0 },
                    ].map(({ icon, v }, i) => (
                      <span key={i} className="flex items-center gap-1 text-gray-400 dark:text-slate-500 text-xs">
                        <span className="text-teal-500">{icon}</span>{v}
                      </span>
                    ))}
                  </div>
                </div>
                <h3 className="text-gray-900 dark:text-white font-semibold group-hover:text-teal-300 transition-colors mb-1">{theme}</h3>
                {excerpt && <p className="text-gray-400 dark:text-slate-500 text-xs leading-relaxed line-clamp-2">{excerpt}</p>}
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
                className="block bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-5 hover:border-teal-600 transition-colors group"
              >
                <p className="text-gray-500 dark:text-slate-400 text-xs mb-1">{formatDateRange(start, end)}</p>
                <h3 className="text-gray-900 dark:text-white font-semibold group-hover:text-teal-300 transition-colors mb-1">{title}</h3>
                {excerpt && <p className="text-gray-400 dark:text-slate-500 text-xs leading-relaxed line-clamp-2">{excerpt}</p>}
              </Link>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-10">
          {page > 1 ? (
            <Link href={buildUrl(page - 1)} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700 text-sm font-semibold transition-colors">
              <ChevronLeft size={14} /> Previous
            </Link>
          ) : (
            <span className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white dark:bg-slate-900 text-gray-400 dark:text-slate-600 text-sm font-semibold cursor-not-allowed">
              <ChevronLeft size={14} /> Previous
            </span>
          )}
          <span className="text-gray-500 dark:text-slate-400 text-sm">
            Page <span className="text-gray-900 dark:text-white font-bold">{page}</span> of{" "}
            <span className="text-gray-900 dark:text-white font-bold">{totalPages}</span>
          </span>
          {page < totalPages ? (
            <Link href={buildUrl(page + 1)} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700 text-sm font-semibold transition-colors">
              Next <ChevronRight size={14} />
            </Link>
          ) : (
            <span className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white dark:bg-slate-900 text-gray-400 dark:text-slate-600 text-sm font-semibold cursor-not-allowed">
              Next <ChevronRight size={14} />
            </span>
          )}
        </div>
      )}
    </div>
  );
}
