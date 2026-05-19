import { searchIdeas } from "@/app/actions/ideaActions";
import { getAuthenticatedUserId } from "@/lib/auth";
import IdeaCard from "@/components/IdeaCard";
import { ideaLikes } from "@/db/schema";
import { db } from "@/db";
import { and, eq, inArray } from "drizzle-orm";
import { Search } from "lucide-react";
import Link from "next/link";

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

  let likedIds: Set<string> = new Set();
  if (callerId && results.length > 0) {
    const ideaIds = results.map((r) => r.idea.id);
    const likes = await db
      .select({ ideaId: ideaLikes.ideaId })
      .from(ideaLikes)
      .where(and(eq(ideaLikes.userId, callerId), inArray(ideaLikes.ideaId, ideaIds)));
    likedIds = new Set(likes.map((l) => l.ideaId));
  }

  const hasQuery   = !!q && q.trim().length >= 2;
  const hasResults = hasQuery && results.length > 0;

  return (
    <main className="min-h-screen">
      <div className="max-w-190 mx-auto px-6 py-12">

        {/* Large search bar */}
        <form method="GET" action="/search">
          <div className={`bg-ic-card border rounded-2xl h-16 flex items-center gap-3 px-5 transition-colors focus-within:border-ic-accent ${hasQuery ? "border-ic-accent" : "border-ic-rule"}`}>
            <Search size={20} className="text-ic-muted shrink-0" />
            <input
              name="q"
              defaultValue={q ?? ""}
              placeholder="Search ideas…"
              autoComplete="off"
              className="font-sans text-lg bg-transparent border-none outline-none flex-1 text-ic-ink placeholder:text-ic-muted"
            />
          </div>
        </form>

        {/* Empty state — no query */}
        {!hasQuery && (
          <div className="flex flex-col items-center text-center pt-16 pb-8">
            <Search size={48} className="text-ic-rule" />
            <p className="font-display italic text-2xl text-ic-muted mt-4">
              What are you looking for?
            </p>
            <p className="font-mono text-[12px] text-ic-muted mt-2">
              Search across all rooms you have access to.
            </p>
          </div>
        )}

        {/* No-results state */}
        {hasQuery && !hasResults && (
          <div className="flex flex-col items-center text-center pt-16 pb-8">
            <Search size={48} className="text-ic-rule" />
            <p className="font-display italic text-2xl text-ic-ink mt-4">
              Nothing found for &ldquo;{q}&rdquo;.
            </p>
            <p className="font-mono text-[12px] text-ic-muted mt-2">
              Try shorter words, or browse by category.
            </p>
            <Link
              href="/explore"
              className="font-mono text-[12px] text-ic-accent hover:text-ic-accent-bright transition-colors mt-4"
            >
              Explore rooms →
            </Link>
          </div>
        )}

        {/* Results */}
        {hasResults && (
          <>
            <p className="font-mono text-[11px] text-ic-muted mt-4 mb-6">
              <span className="text-ic-ink font-semibold">{results.length} result{results.length !== 1 ? "s" : ""}</span>
              {" "}for &ldquo;<span className="text-ic-ink">{q}</span>&rdquo;
            </p>
            <div className="flex flex-col gap-4">
              {results.map(({ idea, author }) => (
                <IdeaCard
                  key={idea.id}
                  idea={idea}
                  author={author ? {
                    name:      author.name,
                    handle:    author.handle,
                    isAi:      author.isAi,
                    avatarUrl: author.avatarUrl,
                  } : null}
                  viewerId={callerId ?? ""}
                  hasLiked={likedIds.has(idea.id)}
                />
              ))}
            </div>
          </>
        )}

      </div>
    </main>
  );
}
