import { db } from "@/db";
import { ideas, likes, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { notFound } from "next/navigation";
import { cache } from "react";
import Link from "next/link";
import IdeaDetailClient from "@/components/IdeaDetailClient";
import ViewCounter from "@/components/ViewCounter";
import { getAuthenticatedUserId } from "@/lib/auth";
import { getComments } from "@/app/actions/commentActions";
import CommunityNotesBanner from "@/components/CommunityNotesBanner";
import CommunityNotesList from "@/components/CommunityNotesList";
import PeerReviewList from "@/components/PeerReviewList";
import PeerReviewBox from "@/components/PeerReviewBox";
import CommentsSection from "@/components/CommentsSection";
import type { Metadata } from "next";

// FIX #36: cache() deduplicates DB queries within a single request —
// generateMetadata and IdeaPage both call this but only one DB hit occurs.
const getIdea = cache(async (id: string) => {
  const [idea] = await db.select().from(ideas).where(eq(ideas.id, id));
  return idea ?? null;
});

const getIdeaAuthor = cache(async (userId: string) => {
  const [author] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return author ?? null;
});

// FIX #40: Use env-aware baseUrl — no more hardcoded vercel.app fallback
function getBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// OG METADATA
// ─────────────────────────────────────────────────────────────────────────────
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id: ideaId } = await params;

  // FIX #36: Uses cached helper — no duplicate DB query
  const idea = await getIdea(ideaId);
  if (!idea) return { title: "Idea Not Found" };

  const author = idea.userId ? await getIdeaAuthor(idea.userId) : null;
  const baseUrl = getBaseUrl();

  const ogUrl =
    `${baseUrl}/api/og?` +
    new URLSearchParams({
      title: idea.title ?? "",
      category: idea.category ?? "General",
      author: author?.name ?? "Anonymous",
      handle: author?.handle ?? "",
      tier: author?.tier ?? "dreamer",
      flair: idea.flair ?? "",
      sparks: String(idea.totalLikes ?? 0),
      views: String(idea.views ?? 0),
    }).toString();

  const description =
    idea.context ?? "An idea anchored on IdeaConnect Genesis Registry.";

  return {
    title: `${idea.title} — IdeaConnect`,
    description,
    openGraph: {
      title: idea.title ?? "IdeaConnect",
      description,
      url: `${baseUrl}/idea/${ideaId}`,
      siteName: "IdeaConnect",
      images: [{ url: ogUrl, width: 1200, height: 630, alt: idea.title ?? "" }],
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title: idea.title ?? "IdeaConnect",
      description,
      images: [ogUrl],
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────────────────────
export default async function IdeaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: ideaId } = await params;

  // FIX #36: cached helper reuses the query from generateMetadata
  const idea = await getIdea(ideaId);
  if (!idea) notFound();

  let viewerId = "";
  let viewerXp = 0;
  try {
    viewerId = (await getAuthenticatedUserId()) ?? "";
  } catch { /* guest */ }

  const [authorResult, likedResult, initialComments, viewerResult] =
    await Promise.all([
      idea.userId ? getIdeaAuthor(idea.userId) : Promise.resolve(null),
      viewerId
        ? db.select({ id: likes.id }).from(likes)
            .where(and(eq(likes.userId, viewerId), eq(likes.ideaId, ideaId)))
            .limit(1)
        : Promise.resolve([]),
      getComments(ideaId),
      viewerId
        ? db.select({ xp: users.xp, name: users.name, handle: users.handle, image: users.image, tier: users.tier })
            .from(users)
            .where(eq(users.id, viewerId))
            .limit(1)
        : Promise.resolve([]),
    ]);

  const author = Array.isArray(authorResult) ? authorResult[0] ?? null : authorResult;
  const hasLiked = likedResult.length > 0;
  const isOwner = Boolean(viewerId && idea.userId === viewerId);
  const isViewer = idea.viewerIds?.includes(viewerId) ?? false;

  // FIX #28: Extract viewer profile for CommentsSection optimistic rendering
  const viewerProfile = viewerResult[0] ?? null;
  viewerXp = viewerProfile?.xp ?? 0;

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

        <CommunityNotesBanner ideaId={ideaId} />

        <IdeaDetailClient
          idea={idea}
          author={author}
          viewerId={viewerId}
          hasLiked={hasLiked}
          isOwner={isOwner}
          isPartner={isViewer}
          initialComments={initialComments}
        />

        <div className="mt-8">
          <CommunityNotesList ideaId={ideaId} ideaTitle={idea.title ?? ""} ideaContext={idea.context ?? ""} />
        </div>

        <div className="mt-8 space-y-6">
          {viewerId && !isOwner && (
            <PeerReviewBox ideaId={ideaId} currentUserXp={viewerXp} />
          )}
          <PeerReviewList ideaId={ideaId} />
        </div>

        {/* FIX #28: Pass all viewer identity props so optimistic comments show real user data */}
        <div className="mt-8 bg-slate-900 border border-slate-800 rounded-3xl px-8 py-8">
          <CommentsSection
            ideaId={ideaId}
            viewerId={viewerId}
            initialComments={initialComments}
            viewerName={viewerProfile?.name ?? null}
            viewerHandle={viewerProfile?.handle ?? null}
            viewerImage={viewerProfile?.image ?? null}
            viewerTier={viewerProfile?.tier ?? null}
            viewerXp={viewerXp}
          />
        </div>

      </div>
    </main>
  );
}
