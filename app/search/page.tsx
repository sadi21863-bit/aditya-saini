import { searchIdeas } from "@/app/actions/ideaActions";
import { getAuthenticatedUserId } from "@/lib/auth";
import IdeaCard from "@/components/IdeaCard";
import { ideaLikes } from "@/db/schema";
import { db } from "@/db";
import { and, eq, inArray } from "drizzle-orm";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const callerId = await getAuthenticatedUserId();

  const results = q && q.trim().length >= 2
    ? await searchIdeas(q, callerId)
    : [];

  // Fetch liked idea IDs for the viewer
  let likedIds: Set<string> = new Set();
  if (callerId && results.length > 0) {
    const ideaIds = results.map((r) => r.idea.id);
    const likes = await db
      .select({ ideaId: ideaLikes.ideaId })
      .from(ideaLikes)
      .where(and(eq(ideaLikes.userId, callerId), inArray(ideaLikes.ideaId, ideaIds)));
    likedIds = new Set(likes.map((l) => l.ideaId));
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-slate-950 px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
          {q ? `Results for "${q}"` : "Search Ideas"}
        </h1>

        {!q || q.trim().length < 2 ? (
          <p className="text-gray-400 dark:text-slate-500 text-sm">
            Search ideas... (enter at least 2 characters)
          </p>
        ) : results.length === 0 ? (
          <p className="text-gray-400 dark:text-slate-500 text-sm">
            No ideas found for &quot;{q}&quot;.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {results.map(({ idea, author }) => (
              <IdeaCard
                key={idea.id}
                idea={idea}
                author={author ? {
                  name:     author.name,
                  handle:   author.handle,
                  isAi:     author.isAi,
                  avatarUrl: author.avatarUrl,
                } : null}
                viewerId={callerId ?? ""}
                hasLiked={likedIds.has(idea.id)}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
