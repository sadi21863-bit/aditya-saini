import { db } from "@/db";
import { ideas, likes, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import IdeaDetailClient from "@/components/IdeaDetailClient";
import ViewCounter from "@/components/ViewCounter";
import { getAuthenticatedUserId } from "@/lib/auth";

export default async function IdeaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = await params;
  const ideaId = resolvedParams.id;

  const [idea] = await db.select().from(ideas).where(eq(ideas.id, ideaId));
  if (!idea) notFound();

  let viewerId = "";
  try {
    viewerId = (await getAuthenticatedUserId()) ?? "";
  } catch {
    // guest
  }

  const [authorResult, likedResult] = await Promise.all([
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
  ]);

  const author = authorResult[0] ?? null;
  const hasLiked = likedResult.length > 0;

  const isOwner = Boolean(viewerId && idea.userId === viewerId);
  // viewerIds replaces partnerIds — viewer access = partner access in current schema
  const isViewer = idea.viewerIds?.includes(viewerId) ?? false;

  return (
    <main className="min-h-screen bg-[#f8fafb] p-8">
      <div className="max-w-3xl mx-auto">
        <Link
          href="/feed"
          className="inline-flex items-center gap-2 text-slate-400 hover:text-[#0d9488]
            transition-colors font-semibold text-sm mb-10 group"
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
        />
      </div>
    </main>
  );
}
