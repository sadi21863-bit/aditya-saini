import { db } from "@/db";
import { ideas, users, likes } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { getAuthenticatedUserId } from "@/lib/auth";
import IdeaCard from "@/components/IdeaCard";
import FeedFilter from "@/components/FeedFilter";

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  const currentUserId = await getAuthenticatedUserId();

  const whereClause =
    category && category !== "all"
      ? and(eq(ideas.status, "public"), eq(ideas.category, category))
      : eq(ideas.status, "public");

  const rawIdeas = await db
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
    .limit(50);

  // Get liked idea IDs for current user
  const likedIds = currentUserId
    ? (
      await db
        .select({ ideaId: likes.ideaId })
        .from(likes)
        .where(eq(likes.userId, currentUserId))
    ).map((l) => l.ideaId)
    : [];

  // Get unique categories for filter bar
  const categoryRows = await db
    .selectDistinct({ category: ideas.category })
    .from(ideas)
    .where(eq(ideas.status, "public"));

  const categories = categoryRows
    .map((c) => c.category)
    .filter(Boolean) as string[];

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <h1 className="text-3xl font-bold text-white mb-2">Genesis Registry</h1>
      <p className="text-slate-400 mb-6 text-sm">
        Ideas anchored to their creators. Immutable. Protected.
      </p>

      <FeedFilter categories={categories} />

      <div className="mt-6 flex flex-col gap-4">
        {rawIdeas.length === 0 && (
          <p className="text-slate-500 text-center py-20">
            No ideas found. Be the first to launch one.
          </p>
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
    </div>
  );
}
