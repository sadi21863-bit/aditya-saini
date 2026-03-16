import { notFound } from "next/navigation";
import { db } from "@/db";
import { ideas, users, follows } from "@/db/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import { getAuthenticatedUserId } from "@/lib/auth";
import { getTierFromXp, tierProgress, xpToNextTier } from "@/lib/tier-engine";
import FollowButton from "@/components/FollowButton";
import IdeaCard from "@/components/IdeaCard";
import PinButton from "@/components/PinButton";
import Link from "next/link";
import { Pin } from "lucide-react";

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;

  let currentUserId: string | null = null;
  try {
    currentUserId = await getAuthenticatedUserId();
  } catch {
    // guest
  }

  const profileUser = await db.query.users.findFirst({
    where: eq(users.handle, handle),
  });

  if (!profileUser) notFound();

  const tier = getTierFromXp(profileUser.xp);
  const progress = tierProgress(profileUser.xp);
  const xpLeft = xpToNextTier(profileUser.xp);
  const isOwnProfile = currentUserId === profileUser.id;

  // All public ideas
  const userIdeas = await db
    .select()
    .from(ideas)
    .where(and(eq(ideas.userId, profileUser.id), eq(ideas.status, "public")))
    .orderBy(desc(ideas.createdAt));

  // Pinned ideas (ordered by pinnedIdeaIds order)
  const pinnedIds = profileUser.pinnedIdeaIds ?? [];
  const pinnedIdeas =
    pinnedIds.length > 0
      ? await db
        .select()
        .from(ideas)
        .where(inArray(ideas.id, pinnedIds))
      : [];

  // Preserve pin order
  const orderedPinned = pinnedIds
    .map((id) => pinnedIdeas.find((i) => i.id === id))
    .filter(Boolean) as typeof pinnedIdeas;

  // Non-pinned ideas
  const unpinnedIdeas = userIdeas.filter((i) => !pinnedIds.includes(i.id));

  // Follow state
  const isFollowing =
    currentUserId && !isOwnProfile
      ? !!(await db.query.follows.findFirst({
        where: and(
          eq(follows.followerId, currentUserId),
          eq(follows.followingId, profileUser.id)
        ),
      }))
      : false;

  const followerCount = await db
    .select()
    .from(follows)
    .where(eq(follows.followingId, profileUser.id))
    .then((r) => r.length);

  const followingCount = await db
    .select()
    .from(follows)
    .where(eq(follows.followerId, profileUser.id))
    .then((r) => r.length);

  const authorMeta = {
    handle: profileUser.handle,
    name: profileUser.name,
    tier: profileUser.tier,
    xp: profileUser.xp,
  };

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">

      {/* Header */}
      <div className="flex items-start justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">
            {profileUser.name ?? `@${profileUser.handle}`}
          </h1>
          <p className="text-slate-400 text-sm mt-1">@{profileUser.handle}</p>
          {profileUser.bio && (
            <p className="text-slate-300 mt-2 text-sm">{profileUser.bio}</p>
          )}
          <div className="flex gap-4 mt-3 text-sm text-slate-400">
            <span>
              <strong className="text-white">{followerCount}</strong> followers
            </span>
            <span>
              <strong className="text-white">{followingCount}</strong> following
            </span>
            <span>
              <strong className="text-white">{userIdeas.length}</strong> ideas
            </span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2 shrink-0">
          {!isOwnProfile && currentUserId && (
            <FollowButton
              currentUserId={currentUserId}
              targetUserId={profileUser.id}
              targetHandle={profileUser.handle ?? ""}
              initialIsFollowing={isFollowing}
            />
          )}
          {isOwnProfile && (
            <Link
              href={`/profile/${handle}/edit`}
              className="text-xs font-bold px-4 py-2 rounded-xl border border-slate-700
                text-slate-400 hover:text-white hover:border-slate-500 transition-colors"
            >
              Edit Profile
            </Link>
          )}
        </div>
      </div>

      {/* Tier Badge */}
      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full
        text-sm font-semibold mb-4 ${tier.bg} ${tier.color}`}>
        {tier.label} · {profileUser.xp} XP
        {xpLeft !== null && (
          <span className="text-xs font-normal opacity-70">
            ({xpLeft} to next tier)
          </span>
        )}
      </div>

      {/* XP Progress Bar */}
      <div className="w-full bg-slate-800 rounded-full h-2 mb-8">
        <div
          className={`h-2 rounded-full ${tier.bg} transition-all`}
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* ── PINNED IDEAS ─────────────────────────────────────────────────── */}
      {orderedPinned.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <Pin size={14} className="text-[#0d9488]" />
            <h2 className="text-sm font-bold text-slate-300 uppercase tracking-widest">
              Pinned
            </h2>
          </div>
          <div className="flex flex-col gap-3">
            {orderedPinned.map((idea) => (
              <div key={idea.id} className="relative">
                <IdeaCard
                  idea={idea}
                  author={authorMeta}
                  viewerId={currentUserId ?? ""}
                  hasLiked={false}
                />
                {isOwnProfile && (
                  <div className="absolute top-3 right-3">
                    <PinButton ideaId={idea.id} initialPinned={true} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── ALL IDEAS ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-white">
          {orderedPinned.length > 0 ? "All Ideas" : "Anchored Ideas"}
        </h2>
        <span className="text-xs text-slate-500">{userIdeas.length} total</span>
      </div>

      {unpinnedIdeas.length === 0 && orderedPinned.length === 0 ? (
        <p className="text-slate-500 text-sm">No public ideas yet.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {unpinnedIdeas.map((idea) => (
            <div key={idea.id} className="relative">
              <IdeaCard
                idea={idea}
                author={authorMeta}
                viewerId={currentUserId ?? ""}
                hasLiked={false}
              />
              {/* Pin button for owner */}
              {isOwnProfile && pinnedIds.length < 3 && (
                <div className="absolute top-3 right-3">
                  <PinButton ideaId={idea.id} initialPinned={false} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
