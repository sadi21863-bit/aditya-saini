import { db } from "@/db";
import { ideas, users, likes, bookmarks } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { getAuthenticatedUserId } from "@/lib/auth";
import IdeaCard from "@/components/IdeaCard";
import FeedFilter from "@/components/FeedFilter";
import IdeaOfTheDay from "@/components/IdeaOfTheDay";
import { computeFeedScore } from "@/lib/feed-score";
import { pickIdeaOfTheDay } from "@/lib/idea-of-the-day";
import { Flame, Clock } from "lucide-react";
import Link from "next/link";

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; sort?: string }>;
}) {
  const { category, sort = "hot" } = await searchParams;
  const currentUserId = await getAuthenticatedUserId();

  const whereClause =
    category && category !== "all"
      ? and(eq(ideas.status, "public"), eq(ideas.category, category))
      : eq(ideas.status, "public");

  // ✅ Fixed: all 4 queries run in parallel instead of sequential
  const [rawIdeas, likedRows, bookmarkedRows, categoryRows] = await Promise.all([
    db
      .select({
        idea: ideas,
        author: {
          handle: users.handle,
          name: users.name,
          tier: users.tier,
          xp: users.xp,
        },
      })
      .from(ideas)
      .leftJoin(users, eq(ideas.userId, users.id))
      .where(whereClause)
      .orderBy(desc(ideas.createdAt))
      .limit(50), // ✅ Fixed: reduced from 100 to 50

    // Liked IDs
    currentUserId
      ? db
        .select({ ideaId: likes.ideaId })
        .from(likes)
        .where(eq(likes.userId, currentUserId))
      : Promise.resolve([]),

    // Bookmarked IDs
    currentUserId
      ? db
        .select({ ideaId: bookmarks.ideaId })
        .from(bookmarks)
        .where(eq(bookmarks.userId, currentUserId))
      : Promise.resolve([]),

    // Categories
    db
      .selectDistinct({ category: ideas.category })
      .from(ideas)
      .where(eq(ideas.status, "public")),
  ]);

  const likedIds = likedRows.map((l) => l.ideaId);
  const bookmarkedIds = bookmarkedRows.map((b) => b.ideaId);
  const categories = categoryRows.map((c) => c.category).filter(Boolean) as string[];

  // ── Sort ─────────────────────────────────────────────────────────────────
  const sorted =
    sort === "new"
      ? rawIdeas
      : [...rawIdeas].sort(
        (a, b) =>
          computeFeedScore(b.idea.totalLikes, b.idea.views, b.idea.createdAt) -
          computeFeedScore(a.idea.totalLikes, a.idea.views, a.idea.createdAt)
      );

  // ── Idea of the Day (only on Hot, no category filter) ───────────────────
  const ideaOfTheDay =
    sort !== "new" && !category ? pickIdeaOfTheDay(rawIdeas) : null;

  // ── Editor's Pick ─────────────────────────────────────────────────────────
  const editorsPick = sorted.find((r) => r.idea.editorsPick);

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

        {/* Sort Toggle */}
        <div className="flex items-center gap-1 bg-slate-800 rounded-xl p-1 shrink-0">
          <Link
            href={`/feed?${category ? `category=${category}&` : ""}sort=hot`}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all
              ${sort !== "new"
                ? "bg-[#0d9488] text-white shadow"
                : "text-slate-400 hover:text-white"
              }`}
          >
            <Flame size={12} /> Hot
          </Link>
          <Link
            href={`/feed?${category ? `category=${category}&` : ""}sort=new`}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all
              ${sort === "new"
                ? "bg-[#0d9488] text-white shadow"
                : "text-slate-400 hover:text-white"
              }`}
          >
            <Clock size={12} /> New
          </Link>
        </div>
      </div>

      {/* 💡 Idea of the Day */}
      {ideaOfTheDay && (
        <IdeaOfTheDay
          idea={ideaOfTheDay.idea}
          author={ideaOfTheDay.author}
        />
      )}

      {/* ⭐ Editor's Pick */}
      {editorsPick && sort !== "new" && (
        <Link
          href={`/idea/${editorsPick.idea.id}`}
          className="block mb-6 p-4 rounded-2xl bg-gradient-to-r from-amber-500/10
            to-teal-500/10 border border-amber-400/30 hover:border-amber-400/60
            transition-all group"
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest">
              ⭐ Editor&apos;s Pick
            </span>
          </div>
          <h2 className="text-base font-bold text-white group-hover:text-[#0d9488]
            transition-colors line-clamp-1">
            {editorsPick.idea.title}
          </h2>
          {editorsPick.idea.context && (
            <p className="text-xs text-slate-400 mt-1 line-clamp-2">
              {editorsPick.idea.context}
            </p>
          )}
        </Link>
      )}

      {/* Category Filter */}
      <FeedFilter categories={categories} />

      {/* Idea List */}
      <div className="mt-6 flex flex-col gap-4">
        {sorted.length === 0 && (
          <p className="text-slate-500 text-center py-20">
            No ideas found. Be the first to launch one.
          </p>
        )}
        {sorted
          .filter((r) => r.idea.id !== ideaOfTheDay?.idea.id)
          .map(({ idea, author }) => (
            <IdeaCard
              key={idea.id}
              idea={idea}
              author={author}
              viewerId={currentUserId ?? ""}
              hasLiked={likedIds.includes(idea.id)}
              initialBookmarked={bookmarkedIds.includes(idea.id)}
            />
          ))}
      </div>
    </div>
  );
}
