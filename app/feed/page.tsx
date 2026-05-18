export const metadata = {
  title:       "Feed — IdeaConnect",
  description: "The latest ideas from rooms you follow.",
};

import { db } from "@/db";
import { ideas, users, ideaLikes, rooms, roomMembers } from "@/db/schema";
import { eq, desc, and, inArray, sql, ne } from "drizzle-orm";
import { getAuthenticatedUserId } from "@/lib/auth";
import IdeaCard from "@/components/IdeaCard";
import FeedFilter from "@/components/FeedFilter";
import { Flame, Clock, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

const PAGE_SIZE = 20;
const AI_LAB_ROOM_ID = process.env.AI_LAB_ROOM_ID ?? "";

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; sort?: string; page?: string }>;
}) {
  const { category, sort = "new", page: pageParam } = await searchParams;
  const page   = Math.max(1, Number(pageParam ?? 1));
  const offset = (page - 1) * PAGE_SIZE;

  const currentUserId = await getAuthenticatedUserId();

  // Get public room IDs + rooms the user is a member of
  const publicRooms = await db
    .select({ id: rooms.id })
    .from(rooms)
    .where(eq(rooms.visibility, "public"));
  const visibleSet = new Set(publicRooms.map((r) => r.id));

  if (currentUserId) {
    const myRooms = await db
      .select({ roomId: roomMembers.roomId })
      .from(roomMembers)
      .where(eq(roomMembers.userId, currentUserId));
    for (const r of myRooms) visibleSet.add(r.roomId);
  }

  const visibleRoomIds = [...visibleSet];

  // Base filter: published + feed-visible + in visible rooms (AI Lab excluded)
  const baseConditions = [
    eq(ideas.status, "published"),
    eq(ideas.feedVisible, true),
    ...(AI_LAB_ROOM_ID ? [ne(ideas.roomId, AI_LAB_ROOM_ID)] : []),
  ];
  if (visibleRoomIds.length > 0) {
    baseConditions.push(inArray(ideas.roomId, visibleRoomIds));
  }
  if (category && category !== "all") {
    baseConditions.push(eq(ideas.category, category));
  }
  const whereClause = and(...baseConditions);

  const orderClause = sort === "hot"
    ? desc(ideas.totalLikes)
    : desc(ideas.createdAt);

  const [rawIdeas, likedRows, categoryRows, totalRow] = await Promise.all([
    db
      .select({
        idea:   ideas,
        author: { handle: users.handle, name: users.name },
      })
      .from(ideas)
      .leftJoin(users, eq(ideas.userId, users.id))
      .where(whereClause)
      .orderBy(orderClause)
      .limit(PAGE_SIZE)
      .offset(offset),

    currentUserId
      ? db.select({ ideaId: ideaLikes.ideaId }).from(ideaLikes).where(eq(ideaLikes.userId, currentUserId))
      : Promise.resolve([]),

    db.selectDistinct({ category: ideas.category }).from(ideas).where(eq(ideas.status, "published")),

    db.select({ count: sql<number>`count(*)` }).from(ideas).where(whereClause),
  ]);

  const likedIds   = likedRows.map((l) => l.ideaId);
  const categories = categoryRows.map((c) => c.category).filter(Boolean) as string[];
  const totalCount = Number(totalRow[0]?.count ?? 0);
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const buildUrl = (p: number) => {
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    if (sort !== "new") params.set("sort", sort);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return `/feed${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">

      {/* Today in AI Lab — compact dark banner */}
      <Link
        href="/ai-lab"
        className="flex items-center gap-4 mb-8 px-5 py-4 bg-[#1A1814] rounded-xl border border-[#2E2A24] hover:border-ic-accent-bright transition-colors"
      >
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-ic-accent-bright animate-pulse" />
          <span className="font-mono text-[10px] uppercase tracking-widest text-[#F4F1EA]/55">
            AI Lab · today
          </span>
        </div>
        <p className="font-display italic text-[#F4F1EA] text-base leading-snug flex-1 min-w-0 truncate">
          When does AI safety become security theatre?
        </p>
        <span className="font-mono text-[12px] font-medium text-ic-accent-bright flex-shrink-0">
          Live →
        </span>
      </Link>

      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-5">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-widest text-ic-muted mb-1">
            Your circles
          </p>
          <h1 className="font-display text-4xl font-normal tracking-tight text-ic-ink leading-tight">
            {sort === "hot" ? "Trending ideas" : "Your feed"}
          </h1>
        </div>

        {/* Sort toggle */}
        <div className="flex items-center border border-ic-rule rounded-lg overflow-hidden shrink-0">
          <Link
            href={`/feed?${category ? `category=${category}&` : ""}sort=hot`}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-mono font-medium transition-all ${
              sort === "hot"
                ? "bg-ic-ink text-ic-paper"
                : "text-ic-muted hover:text-ic-ink"
            }`}
          >
            <Flame size={11} /> Hot
          </Link>
          <div className="w-px h-4 bg-ic-rule" />
          <Link
            href={`/feed?${category ? `category=${category}&` : ""}sort=new`}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-mono font-medium transition-all ${
              sort !== "hot"
                ? "bg-ic-ink text-ic-paper"
                : "text-ic-muted hover:text-ic-ink"
            }`}
          >
            <Clock size={11} /> New
          </Link>
        </div>
      </div>

      <Suspense fallback={<div className="h-10 mb-6" />}>
        <FeedFilter categories={categories} />
      </Suspense>

      {/* Ideas list */}
      <div className="flex flex-col gap-3">
        {rawIdeas.length === 0 && (
          <div className="text-center py-20">
            <p className="font-mono text-sm text-ic-muted mb-4">No ideas found.</p>
            <Link href="/explore" className="font-mono text-[13px] text-ic-accent hover:underline">
              Explore rooms →
            </Link>
          </div>
        )}
        {rawIdeas.map(({ idea, author }) => (
          <IdeaCard
            key={idea.id}
            idea={idea}
            author={author}
            viewerId={currentUserId ?? ""}
            hasLiked={likedIds.includes(idea.id)}
          />
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-10">
          {page > 1 ? (
            <Link
              href={buildUrl(page - 1)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-ic-rule text-ic-muted hover:border-ic-ink hover:text-ic-ink font-mono text-xs transition-colors"
            >
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
            <Link
              href={buildUrl(page + 1)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-ic-rule text-ic-muted hover:border-ic-ink hover:text-ic-ink font-mono text-xs transition-colors"
            >
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
