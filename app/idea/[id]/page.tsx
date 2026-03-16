import { db } from "@/db";
import { ideas, likes, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import IdeaDetailClient from "@/components/IdeaDetailClient";
import ViewCounter from "@/components/ViewCounter";
import { getAuthenticatedUserId } from "@/lib/auth";
import { getComments } from "@/app/actions/commentActions";

export default async function IdeaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: ideaId } = await params;

  const [idea] = await db.select().from(ideas).where(eq(ideas.id, ideaId));
  if (!idea) notFound();

  let viewerId = "";
  try {
    viewerId = (await getAuthenticatedUserId()) ?? "";
  } catch {
    // guest
  }

  const [authorResult, likedResult, initialComments] = await Promise.all([
    idea.userId
      ? db.select().from(users).where(eq(users.id, idea.userId)).limit(1)
      : Promise.resolve([]),
    viewerId
      ? db
        .select({ id: likes.id })
        .from(likes)
        .where(and(eq(likes.userId, viewerId), eq(likes.ideaId, ideaId)))
        .limit(1)
      : Promise.resolve([]),
    getComments(ideaId),
  ]);

  const author = authorResult[0] ?? null;
  const hasLiked = likedResult.length > 0;
  const isOwner = Boolean(viewerId && idea.userId === viewerId);
  const isViewer = idea.viewerIds?.includes(viewerId) ?? false;

  return (
    <main className="min-h-screen bg-slate-950 py-10 px-4">
      <div className="max-w-4xl mx-auto">
        <Link
          href="/feed"
          className="inline-flex items-center gap-2 text-slate-400 hover:text-[#0d9488]
            transition-colors font-semibold text-sm mb-8 group"
        >
          <span className="group-hover:-translate-x-1 transition-transform">←</span>
          Back to Feed
        </Link>

        <ViewCounter id={ideaId} />

        <IdeaDetailClient
          idea={idea}
          author={author}
          viewerId={viewerId}
          hasLiked={hasLiked}
          isOwner={isOwner}
          isPartner={isViewer}
          initialComments={initialComments}
        />
      </div>
    </main>
  );
}
