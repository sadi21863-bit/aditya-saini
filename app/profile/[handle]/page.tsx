import { notFound } from "next/navigation";
import { db } from "@/db";
import { ideas, users, follows } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { getAuthenticatedUserId } from "@/lib/auth";
import { getTierFromXp, tierProgress, xpToNextTier } from "@/lib/tier-engine";
import FollowButton from "@/components/FollowButton";
import IdeaCard from "@/components/IdeaCard";

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const currentUserId = await getAuthenticatedUserId();

  // Resolve handle → user
  const profileUser = await db.query.users.findFirst({
    where: eq(users.handle, handle),
  });

  if (!profileUser) notFound();

  const tier = getTierFromXp(profileUser.xp);
  const progress = tierProgress(profileUser.xp);
  const xpLeft = xpToNextTier(profileUser.xp);
  const isOwnProfile = currentUserId === profileUser.id;

  // Get user's public ideas
  const userIdeas = await db
    .select()
    .from(ideas)
    .where(and(eq(ideas.userId, profileUser.id), eq(ideas.status, "public")))
    .orderBy(desc(ideas.createdAt));

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

  // Follower / following counts
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

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
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

        {!isOwnProfile && currentUserId && (
          <FollowButton
            followerId={currentUserId}
            targetId={profileUser.id}
            initialFollowing={isFollowing}
          />
        )}
      </div>

      {/* Tier Badge */}
      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold mb-6 ${tier.bg} ${tier.color}`}>
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

      {/* Ideas */}
      <h2 className="text-xl font-bold text-white mb-4">Anchored Ideas</h2>
      {userIdeas.length === 0 ? (
        <p className="text-slate-500 text-sm">No public ideas yet.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {userIdeas.map((idea) => (
            <IdeaCard
              key={idea.id}
              idea={idea}
              author={{
                handle: profileUser.handle,
                name: profileUser.name,
                tier: profileUser.tier,
                xp: profileUser.xp,
              }}
              viewerId={currentUserId ?? ""}
              hasLiked={false}
            />
          ))}
        </div>
      )}
    </div>
  );
}
