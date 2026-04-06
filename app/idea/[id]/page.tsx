import { db } from "@/db";
import { ideas, ideaLikes, users, rooms } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { notFound } from "next/navigation";
import { cache } from "react";
import Link from "next/link";
import IdeaDetailClient from "@/components/IdeaDetailClient";
import { getAuthenticatedUserId } from "@/lib/auth";
import { getComments } from "@/app/actions/commentActions";
import { recordView } from "@/app/actions/ideaActions";
import CommentsSection from "@/components/CommentsSection";
import type { Metadata } from "next";

const getIdea = cache(async (id: string) => {
  const [idea] = await db.select().from(ideas).where(eq(ideas.id, id));
  return idea ?? null;
});

const getIdeaAuthor = cache(async (userId: string) => {
  const [author] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return author ?? null;
});

function getBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id: ideaId } = await params;
  const idea = await getIdea(ideaId);
  if (!idea) return { title: "Idea Not Found" };

  const author = idea.userId ? await getIdeaAuthor(idea.userId) : null;
  const baseUrl = getBaseUrl();

  const ogUrl =
    `${baseUrl}/api/og?` +
    new URLSearchParams({
      title:    idea.title ?? "",
      category: idea.category ?? "General",
      author:   author?.name ?? "Anonymous",
      handle:   author?.handle ?? "",
      sparks:   String(idea.totalLikes ?? 0),
      views:    String(idea.views ?? 0),
    }).toString();

  const description = idea.context ?? "An idea on IdeaConnect.";

  return {
    title: `${idea.title} — IdeaConnect`,
    description,
    openGraph: {
      title:       idea.title ?? "IdeaConnect",
      description,
      url:         `${baseUrl}/idea/${ideaId}`,
      siteName:    "IdeaConnect",
      images:      [{ url: ogUrl, width: 1200, height: 630, alt: idea.title ?? "" }],
      type:        "article",
    },
    twitter: {
      card:        "summary_large_image",
      title:       idea.title ?? "IdeaConnect",
      description,
      images:      [ogUrl],
    },
  };
}

export default async function IdeaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: ideaId } = await params;
  const idea = await getIdea(ideaId);
  if (!idea) notFound();

  let viewerId = "";
  try { viewerId = (await getAuthenticatedUserId()) ?? ""; } catch { /* guest */ }

  // Record view
  if (viewerId) {
    recordView(ideaId).catch(() => {});
  }

  const [authorResult, likedResult, initialComments, roomResult, viewerResult] =
    await Promise.all([
      idea.userId ? getIdeaAuthor(idea.userId) : Promise.resolve(null),

      viewerId
        ? db
            .select({ id: ideaLikes.id })
            .from(ideaLikes)
            .where(and(eq(ideaLikes.userId, viewerId), eq(ideaLikes.ideaId, ideaId)))
            .limit(1)
        : Promise.resolve([]),

      getComments(ideaId),

      idea.roomId
        ? db.select({ name: rooms.name }).from(rooms).where(eq(rooms.id, idea.roomId)).limit(1)
        : Promise.resolve([]),

      viewerId
        ? db
            .select({ name: users.name, handle: users.handle, image: users.image })
            .from(users)
            .where(eq(users.id, viewerId))
            .limit(1)
        : Promise.resolve([]),
    ]);

  const author        = Array.isArray(authorResult) ? authorResult[0] ?? null : authorResult;
  const hasLiked      = likedResult.length > 0;
  const isOwner       = Boolean(viewerId && idea.userId === viewerId);
  const roomName      = roomResult[0]?.name ?? null;
  const viewerProfile = viewerResult[0] ?? null;

  return (
    <main className="min-h-screen bg-slate-950 py-10 px-4">
      <div className="max-w-4xl mx-auto">
        <Link
          href={idea.roomId ? `/rooms/${idea.roomId}` : "/feed"}
          className="inline-flex items-center gap-2 text-slate-400 hover:text-[#0d9488]
            transition-colors font-semibold text-sm mb-8 group"
        >
          <span className="group-hover:-translate-x-1 transition-transform">←</span>
          {roomName ? `Back to ${roomName}` : "Back to Feed"}
        </Link>

        <IdeaDetailClient
          idea={idea}
          author={author}
          viewerId={viewerId}
          hasLiked={hasLiked}
          isOwner={isOwner}
          roomName={roomName}
        />

        {/* Comments */}
        <div className="mt-8 bg-slate-900 border border-slate-800 rounded-3xl px-8 py-8">
          <CommentsSection
            ideaId={ideaId}
            ideaOwnerId={idea.userId ?? undefined}
            viewerId={viewerId}
            initialComments={initialComments}
            viewerName={viewerProfile?.name ?? null}
            viewerHandle={viewerProfile?.handle ?? null}
            viewerImage={viewerProfile?.image ?? null}
          />
        </div>
      </div>
    </main>
  );
}
