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
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
            {sort === "hot" ? "Trending Ideas" : "Latest Ideas"}
          </h1>
          <p className="text-gray-500 dark:text-slate-400 text-sm">
            Ideas from your rooms and the community. <Link href="/ai-lab" className="text-teal-500 hover:text-teal-400 transition-colors">AI Lab →</Link>
          </p>
        </div>

        <div className="flex items-center gap-1 bg-gray-100 dark:bg-slate-800 rounded-xl p-1 shrink-0">
          <Link
            href={`/feed?${category ? `category=${category}&` : ""}sort=hot`}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              sort === "hot" ? "bg-[#0d9488] text-white shadow" : "text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
            }`}
          >
            <Flame size={12} /> Hot
          </Link>
          <Link
            href={`/feed?${category ? `category=${category}&` : ""}sort=new`}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              sort !== "hot" ? "bg-[#0d9488] text-white shadow" : "text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
            }`}
          >
            <Clock size={12} /> New
          </Link>
        </div>
      </div>

      <Suspense fallback={<div className="h-10 mb-8" />}>
        <FeedFilter categories={categories} />
      </Suspense>

      <div className="mt-6 flex flex-col gap-4">
        {rawIdeas.length === 0 && (
          <p className="text-gray-400 dark:text-slate-500 text-center py-20">No ideas found. Create a room and post your first one.</p>
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
