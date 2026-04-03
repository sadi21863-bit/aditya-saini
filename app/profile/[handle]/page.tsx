import { notFound } from "next/navigation";
import { db } from "@/db";
import { ideas, users, follows, rooms, roomMembers } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { getAuthenticatedUserId } from "@/lib/auth";
import FollowButton from "@/components/FollowButton";
import IdeaCard from "@/components/IdeaCard";
import Link from "next/link";
import { Globe, Lock } from "lucide-react";

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;

  let currentUserId: string | null = null;
  try {
    currentUserId = await getAuthenticatedUserId();
  } catch { /* guest */ }

  const profileUser = await db.query.users.findFirst({
    where: eq(users.handle, handle),
  });
  if (!profileUser) notFound();

  const isOwnProfile = currentUserId === profileUser.id;

  const [userIdeas, userRooms, followState, followerRows, followingRows] =
    await Promise.all([
      db
        .select()
        .from(ideas)
        .where(and(eq(ideas.userId, profileUser.id), eq(ideas.status, "published")))
        .orderBy(desc(ideas.createdAt)),

      db
        .select({
          roomId: roomMembers.roomId,
          role: roomMembers.role,
          roomName: rooms.name,
          roomVisibility: rooms.visibility,
        })
        .from(roomMembers)
        .innerJoin(rooms, eq(roomMembers.roomId, rooms.id))
        .where(eq(roomMembers.userId, profileUser.id)),

      currentUserId && !isOwnProfile
        ? db.query.follows.findFirst({
            where: and(
              eq(follows.followerId, currentUserId),
              eq(follows.followingId, profileUser.id)
            ),
          })
        : Promise.resolve(undefined),

      db
        .select({ id: follows.id })
        .from(follows)
        .where(eq(follows.followingId, profileUser.id)),

      db
        .select({ id: follows.id })
        .from(follows)
        .where(eq(follows.followerId, profileUser.id)),
    ]);

  const isFollowing = !!followState;
  const followerCount = followerRows.length;
  const followingCount = followingRows.length;

  // Only show public rooms to non-owners
  const visibleRooms = isOwnProfile
    ? userRooms
    : userRooms.filter((r) => r.roomVisibility === "public");

  const authorMeta = {
    handle: profileUser.handle,
    name: profileUser.name,
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
            <span><strong className="text-white">{followerCount}</strong> followers</span>
            <span><strong className="text-white">{followingCount}</strong> following</span>
            <span><strong className="text-white">{userIdeas.length}</strong> ideas</span>
            <span><strong className="text-white">{visibleRooms.length}</strong> rooms</span>
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

      {/* Rooms */}
      {visibleRooms.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-bold text-white mb-4">Rooms</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {visibleRooms.map((r) => (
              <Link
                key={r.roomId}
                href={`/rooms/${r.roomId}`}
                className="bg-slate-900 border border-slate-800 rounded-xl p-4
                  hover:border-teal-700/50 transition-colors group"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white group-hover:text-teal-400 transition-colors truncate">
                    {r.roomName}
                  </h3>
                  {r.roomVisibility === "private" ? (
                    <Lock size={12} className="text-slate-500 shrink-0" />
                  ) : (
                    <Globe size={12} className="text-teal-500 shrink-0" />
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-1 capitalize">{r.role}</p>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Ideas */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-white">Ideas</h2>
        <span className="text-xs text-slate-500">{userIdeas.length} total</span>
      </div>

      {userIdeas.length === 0 ? (
        <p className="text-slate-500 text-sm">No published ideas yet.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {userIdeas.map((idea) => (
            <IdeaCard
              key={idea.id}
              idea={idea}
              author={authorMeta}
              viewerId={currentUserId ?? ""}
              hasLiked={false}
            />
          ))}
        </div>
      )}
    </div>
  );
}
