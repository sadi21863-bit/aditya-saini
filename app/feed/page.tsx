import { db } from "@/db";
import { ideas, users, ideaLikes } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { getAuthenticatedUserId } from "@/lib/auth";
import IdeaCard from "@/components/IdeaCard";
import FeedFilter from "@/components/FeedFilter";
import IdeaOfTheDay from "@/components/IdeaOfTheDay";
import { computeFeedScore } from "@/lib/feed-score";
import { pickIdeaOfTheDay } from "@/lib/idea-of-the-day";
import { Flame, Clock, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

// v14: IdeaCard already reads idea.genesisHash internally — no extra JOIN needed.
// The genesis badge in the card is driven by idea.genesisHash (already on the ideas row).
const PAGE_SIZE = 20;

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; sort?: string; page?: string }>;
}) {
  const { category, sort = "hot", page: pageParam } = await searchParams;
  const page   = Math.max(1, Number(pageParam ?? 1));
  const offset = (page - 1) * PAGE_SIZE;

  const currentUserId = await getAuthenticatedUserId();

  const whereClause =
    category && category !== "all"
      ? and(eq(ideas.status, "published"), eq(ideas.category, category))
      : eq(ideas.status, "published");

  const [rawIdeas, likedRows, categoryRows, totalRow] = await Promise.all([
    db
      .select({
        idea:   ideas,
        author: { handle: users.handle, name: users.name, tier: users.tier, xp: users.xp },
      })
      .from(ideas)
      .leftJoin(users, eq(ideas.userId, users.id))
      .where(whereClause)
      .orderBy(desc(ideas.createdAt))
      .limit(PAGE_SIZE)
      .offset(offset),

    currentUserId
      ? db.select({ ideaId: ideaLikes.ideaId }).from(ideaLikes).where(eq(ideaLikes.userId, currentUserId))
      : Promise.resolve([]),

    db.selectDistinct({ category: ideas.category }).from(ideas).where(eq(ideas.status, "published")),
    db.select({ id: ideas.id }).from(ideas).where(whereClause),
  ]);

  const likedIds   = likedRows.map((l) => l.ideaId);
  const categories = categoryRows.map((c) => c.category).filter(Boolean) as string[];
  const totalCount = totalRow.length;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const sorted =
    sort === "new"
      ? rawIdeas
      : [...rawIdeas].sort(
          (a, b) =>
            computeFeedScore(b.idea.totalLikes, b.idea.views, b.idea.createdAt) -
            computeFeedScore(a.idea.totalLikes, a.idea.views, a.idea.createdAt)
        );

  const ideaOfTheDay = sort !== "new" && !category ? pickIdeaOfTheDay(rawIdeas) : null;
  const editorsPick  = page === 1 ? sorted.find((r) => r.idea.editorsPick) : null;

  const buildUrl = (p: number) => {
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    if (sort !== "hot") params.set("sort", sort);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return `/feed${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-white mb-1">
            {sort === "hot" ? "🔥 Trending Ideas" : "✨ Latest Ideas"}
          </h1>
          <p className="text-slate-400 text-sm">
            Ideas anchored to their creators. Immutable. Protected.
          </p>
        </div>

        <div className="flex items-center gap-1 bg-slate-800 rounded-xl p-1 shrink-0">
          <Link
            href={`/feed?${category ? `category=${category}&` : ""}sort=hot`}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              sort !== "new" ? "bg-[#0d9488] text-white shadow" : "text-slate-400 hover:text-white"
            }`}
          >
            <Flame size={12} /> Hot
          </Link>
          <Link
            href={`/feed?${category ? `category=${category}&` : ""}sort=new`}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              sort === "new" ? "bg-[#0d9488] text-white shadow" : "text-slate-400 hover:text-white"
            }`}
          >
            <Clock size={12} /> New
          </Link>
        </div>
      </div>

      {page === 1 && ideaOfTheDay && (
        <IdeaOfTheDay idea={ideaOfTheDay.idea} author={ideaOfTheDay.author} />
      )}

      {editorsPick && sort !== "new" && page === 1 && (
        <Link
          href={`/idea/${editorsPick.idea.id}`}
          className="block mb-6 p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 to-teal-500/10
            border border-amber-400/30 hover:border-amber-400/60 transition-all group"
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest">
              ⭐ Editor&apos;s Pick
            </span>
          </div>
          <h2 className="text-base font-bold text-white group-hover:text-[#0d9488] transition-colors line-clamp-1">
            {editorsPick.idea.title}
          </h2>
          {editorsPick.idea.context && (
            <p className="text-xs text-slate-400 mt-1 line-clamp-2">{editorsPick.idea.context}</p>
          )}
        </Link>
      )}

      <Suspense fallback={<div className="h-10 mb-8" />}>
        <FeedFilter categories={categories} />
      </Suspense>

      <div className="mt-6 flex flex-col gap-4">
        {sorted.length === 0 && (
          <p className="text-slate-500 text-center py-20">No ideas found. Be the first to launch one.</p>
        )}
        {sorted
          .filter((r) => r.idea.id !== ideaOfTheDay?.idea.id && r.idea.id !== editorsPick?.idea.id)
          .map(({ idea, author }) => (
            <IdeaCard
              key={idea.id}
              idea={idea}
              author={author}
              viewerId={currentUserId ?? ""}
              hasLiked={likedIds.includes(idea.id)}
            />
          ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-10">
          {page > 1 ? (
            <Link href={buildUrl(page - 1)} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 text-sm font-semibold transition-colors">
              <ChevronLeft size={14} /> Previous
            </Link>
          ) : (
            <span className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 text-slate-600 text-sm font-semibold cursor-not-allowed">
              <ChevronLeft size={14} /> Previous
            </span>
          )}
          <span className="text-slate-400 text-sm">
            Page <span className="text-white font-bold">{page}</span> of{" "}
            <span className="text-white font-bold">{totalPages}</span>
          </span>
          {page < totalPages ? (
            <Link href={buildUrl(page + 1)} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 text-sm font-semibold transition-colors">
              Next <ChevronRight size={14} />
            </Link>
          ) : (
            <span className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 text-slate-600 text-sm font-semibold cursor-not-allowed">
              Next <ChevronRight size={14} />
            </span>
          )}
        </div>
      )}
    </div>
  );
}
