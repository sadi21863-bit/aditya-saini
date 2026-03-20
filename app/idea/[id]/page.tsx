import { db } from "@/db";
import { ideas, likes, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import IdeaDetailClient from "@/components/IdeaDetailClient";
import ViewCounter from "@/components/ViewCounter";
import { getAuthenticatedUserId } from "@/lib/auth";
import { getComments } from "@/app/actions/commentActions";
import CommunityNotesBanner from "@/components/CommunityNotesBanner";
import PeerReviewList from "@/components/PeerReviewList";
import PeerReviewBox from "@/components/PeerReviewBox";
import GenesisProof from "@/components/GenesisProof";
import type { Metadata } from "next";

// ─────────────────────────────────────────────────────────────────────────────
// OG METADATA
// ─────────────────────────────────────────────────────────────────────────────
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id: ideaId } = await params;

  const [idea] = await db.select().from(ideas).where(eq(ideas.id, ideaId));
  if (!idea) return { title: "Idea Not Found" };

  const author = idea.userId
    ? (await db.select().from(users).where(eq(users.id, idea.userId)).limit(1))[0] ?? null
    : null;

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? "https://ideaconnect.vercel.app";

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

  const [idea] = await db.select().from(ideas).where(eq(ideas.id, ideaId));
  if (!idea) notFound();

  let viewerId = "";
  let viewerXp = 0;
  try {
    viewerId = (await getAuthenticatedUserId()) ?? "";
  } catch { /* guest */ }

  const [authorResult, likedResult, initialComments, viewerResult] =
    await Promise.all([
      idea.userId
        ? db.select().from(users).where(eq(users.id, idea.userId)).limit(1)
        : Promise.resolve([]),
      viewerId
        ? db.select({ id: likes.id }).from(likes)
          .where(and(eq(likes.userId, viewerId), eq(likes.ideaId, ideaId)))
          .limit(1)
        : Promise.resolve([]),
      getComments(ideaId),
      viewerId
        ? db.select({ xp: users.xp }).from(users)
          .where(eq(users.id, viewerId)).limit(1)
        : Promise.resolve([]),
    ]);

  const author = authorResult[0] ?? null;
  const hasLiked = likedResult.length > 0;
  const isOwner = Boolean(viewerId && idea.userId === viewerId);
  const isViewer = idea.viewerIds?.includes(viewerId) ?? false;
  viewerXp = viewerResult[0]?.xp ?? 0;

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

        {/* ── TRUTH LAYER: Community Notes Banner ─────────────────────── */}
        <CommunityNotesBanner ideaId={ideaId} />

        {/* ── MAIN IDEA DETAIL ────────────────────────────────────────── */}
        <IdeaDetailClient
          idea={idea}
          author={author}
          viewerId={viewerId}
          hasLiked={hasLiked}
          isOwner={isOwner}
          isPartner={isViewer}
          initialComments={initialComments}
        />

        {/* ── GENESIS PROOF ───────────────────────────────────────────── */}
        {idea.genesisHash && (
          <div className="mt-8">
            <GenesisProof
              genesisHash={idea.genesisHash}
              simHash={idea.simHash}
              createdAt={idea.createdAt}
              ideaId={ideaId}
            />
          </div>
        )}

        {/* ── PEER REVIEW SECTION ─────────────────────────────────────── */}
        <div className="mt-8 space-y-6">
          {/* Submit review — only if not owner and logged in */}
          {viewerId && !isOwner && (
            <PeerReviewBox ideaId={ideaId} currentUserXp={viewerXp} />
          )}
          <PeerReviewList ideaId={ideaId} />
        </div>

      </div>
    </main>
  );
}
