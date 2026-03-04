import { db } from "@/db";
import { ideas, likes, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import IdeaDetailClient from "@/components/IdeaDetailClient";
import ViewCounter from "@/components/ViewCounter";
import { getAuthenticatedUserId } from "@/lib/auth";

/**
 * app/idea/[id]/page.tsx
 *
 * Server Component responsibilities:
 *   1. await params (Next.js 16 requirement) using resolvedParams
 *   2. Fetch idea, author, hasLiked in parallel
 *   3. Compute isOwner + isPartner server-side — never expose to client as raw data
 *   4. Render <ViewCounter> client component which POSTs to /api/view/[id]
 *      That route owns cookie-based dedup and the actual DB increment.
 *      We never call recordView() here to avoid double-counting.
 */
export default async function IdeaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // ── Step 1: Next.js 16 — always use resolvedParams pattern ────────────────
  const resolvedParams = await params;
  const ideaId = resolvedParams.id;

  // ── Step 2: Fetch the idea ────────────────────────────────────────────────
  const [idea] = await db.select().from(ideas).where(eq(ideas.id, ideaId));
  if (!idea) notFound();

  // ── Step 3: Identify the viewer (Clerk-ready, falls back to placeholder) ──
  let viewerId = "";
  try {
    viewerId = await getAuthenticatedUserId();
  } catch {
    // Unauthenticated guest — blur reveal and like features won't work
  }

  // ── Step 4: Fetch author + like status in a single parallel round trip ────
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

  // ── Step 5: Compute access flags ──────────────────────────────────────────
  const isOwner = Boolean(viewerId && idea.userId === viewerId);
  const isPartner = Boolean(viewerId && idea.partnerIds?.includes(viewerId));

  return (
    <main className="min-h-screen bg-[#f8fafb] p-8">
      <div className="max-w-3xl mx-auto">

        {/* Back navigation */}
        <Link
          href="/feed"
          className="inline-flex items-center gap-2 text-slate-400 hover:text-[#0d9488]
            transition-colors font-semibold text-sm mb-10 group"
        >
          <span className="group-hover:-translate-x-1 transition-transform">←</span>
          Back to Feed
        </Link>

        {/*
          ViewCounter fires POST /api/view/[id] on mount.
          The API route checks the cookie and increments DB if not yet seen.
          No server-side recordView() call here — single source of truth.
        */}
        <ViewCounter id={ideaId} />

        {/*
          All security flags (hasLiked, isOwner, isPartner) are
          pre-computed server-side and passed as props.
          No DB queries run inside the client component.
        */}
        <IdeaDetailClient
          idea={idea}
          author={author}
          viewerId={viewerId}
          hasLiked={hasLiked}
          isOwner={isOwner}
          isPartner={isPartner}
        />

      </div>
    </main>
  );
}
