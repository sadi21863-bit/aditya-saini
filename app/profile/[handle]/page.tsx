import { notFound } from "next/navigation";
import { db } from "@/db";
import { ideas, users, follows, rooms, roomMembers } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { getAuthenticatedUserId } from "@/lib/auth";
import FollowButton from "@/components/FollowButton";
import IdeaCard from "@/components/IdeaCard";
import Link from "next/link";
import { Lock } from "lucide-react";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const { handle } = await params;
  return {
    title:       `@${handle} — IdeaConnect`,
    description: `View @${handle}'s ideas and rooms on IdeaConnect.`,
  };
}

// IC_AI lookup for agent profile cards
const IC_CAT_KNOWN = ["climate","urbanism","ai","biotech","games","philosophy","hardware","tools"] as const;
function catClass(cat: string | null): string {
  const c = (cat ?? "").toLowerCase();
  return IC_CAT_KNOWN.includes(c as typeof IC_CAT_KNOWN[number]) ? `ic-cat-${c}` : "ic-cat-tools";
}

const AGENT_META: Record<string, { glyph: string; bgCls: string; fgCls: string; desc: string }> = {
  "llama":    { glyph: "◆", bgCls: "bg-ic-ai-llama-bg",    fgCls: "text-ic-ai-llama-fg",    desc: "Thoughtful, grounded reasoning. Daily participant in AI Lab debates." },
  "gpt-oss":  { glyph: "◈", bgCls: "bg-ic-ai-gptoss-bg",   fgCls: "text-ic-ai-gptoss-fg",   desc: "Precision-focused analysis. Daily participant in AI Lab debates." },
  "scout":    { glyph: "▲", bgCls: "bg-ic-ai-scout-bg",    fgCls: "text-ic-ai-scout-fg",    desc: "Pattern recognition, fast thinking. Daily participant in AI Lab debates." },
  "maverick": { glyph: "◉", bgCls: "bg-ic-ai-maverick-bg", fgCls: "text-ic-ai-maverick-fg", desc: "Challenges frames, questions assumptions. Daily participant in AI Lab debates." },
  "research": { glyph: "⬡", bgCls: "bg-ic-ai-research-bg", fgCls: "text-ic-ai-research-fg", desc: "Drops in with real data and citations. AI Lab researcher." },
};

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
    columns: { password: false },
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
          roomCategory: rooms.category,
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

  const visibleRooms = isOwnProfile
    ? userRooms
    : userRooms.filter((r) => r.roomVisibility === "public");

  const authorMeta = {
    handle: profileUser.handle,
    name: profileUser.name,
  };

  const agentInfo = profileUser.isAi ? AGENT_META[profileUser.handle ?? ""] ?? null : null;

  const tabs = ["Ideas", "Rooms", "Sparked", ...(isOwnProfile ? ["Bookmarks"] : [])];

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">

      {/* Banner */}
      <div className="h-32 rounded-2xl bg-gradient-to-r from-ic-ink to-ic-paper-deep" />

      {/* Avatar + header */}
      <div className="px-2">
        {/* Avatar — overlaps banner */}
        <div className="-mt-10 mb-3">
          <div className="w-20 h-20 rounded-full border-4 border-ic-paper bg-ic-paper-deep flex items-center justify-center font-mono text-2xl font-semibold text-ic-muted relative overflow-hidden shrink-0">
            {profileUser.avatarUrl ? (
              <img
                src={profileUser.avatarUrl}
                alt=""
                className="absolute inset-0 w-full h-full object-cover"
                onError={undefined}
              />
            ) : (
              <span>{(profileUser.name ?? profileUser.handle ?? "?")[0]?.toUpperCase()}</span>
            )}
          </div>
        </div>

        {/* Handle + display name + bio + stats + action */}
        <div className="flex items-start justify-between gap-4 mb-5">
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-3xl font-normal tracking-tight text-ic-ink leading-tight">
              @{profileUser.handle}
            </h1>
            {profileUser.name && (
              <p className="text-ic-ink-soft mt-0.5">{profileUser.name}</p>
            )}
            {profileUser.bio && (
              <p className="text-ic-ink-soft text-sm mt-2 max-w-lg leading-relaxed">{profileUser.bio}</p>
            )}
            <div className="flex flex-wrap items-center gap-4 mt-3 font-mono text-[11px] text-ic-muted">
              <span><span className="text-ic-ink font-semibold">{followerCount}</span> followers</span>
              <span><span className="text-ic-ink font-semibold">{followingCount}</span> following</span>
              <span><span className="text-ic-ink font-semibold">{userIdeas.length}</span> ideas</span>
            </div>
          </div>

          <div className="shrink-0 mt-1">
            {!isOwnProfile && currentUserId && (
              <FollowButton
                currentUserId={currentUserId}
                targetUserId={profileUser.id}
                initialIsFollowing={isFollowing}
              />
            )}
            {isOwnProfile && (
              <Link
                href={`/profile/${handle}/edit`}
                className="px-4 py-2 rounded-lg border border-ic-rule text-ic-muted font-mono text-xs
                  hover:border-ic-accent hover:text-ic-ink transition-colors"
              >
                Edit Profile
              </Link>
            )}
          </div>
        </div>

        {/* AI Agent profile card */}
        {agentInfo && (
          <div className="mb-5 flex items-start gap-3 p-4 bg-ic-paper-deep border border-ic-rule rounded-xl">
            <span className={`w-10 h-10 rounded flex items-center justify-center font-mono text-lg font-semibold shrink-0 ${agentInfo.bgCls} ${agentInfo.fgCls}`}>
              {agentInfo.glyph}
            </span>
            <div>
              <p className="font-mono text-[11px] uppercase tracking-widest text-ic-muted mb-1">AI Participant</p>
              <p className="text-sm text-ic-ink-soft leading-relaxed">{agentInfo.desc}</p>
            </div>
          </div>
        )}

        {/* Tab bar — Ideas active by default */}
        <div className="flex gap-6 border-b border-ic-rule mb-6">
          {tabs.map((tab, i) => (
            <span
              key={tab}
              className={`pb-3 font-mono text-[12px] font-medium cursor-default select-none ${
                i === 0
                  ? "border-b-2 border-ic-ink text-ic-ink -mb-px"
                  : "text-ic-muted hover:text-ic-ink-soft"
              }`}
            >
              {tab}
            </span>
          ))}
        </div>

        {/* Ideas */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-2xl font-normal text-ic-ink">Ideas</h2>
            <span className="font-mono text-[11px] text-ic-muted">{userIdeas.length} total</span>
          </div>

          {userIdeas.length === 0 ? (
            <p className="font-mono text-sm text-ic-muted">No published ideas yet.</p>
          ) : (
            <div className="flex flex-col gap-3">
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

        {/* Rooms */}
        {visibleRooms.length > 0 && (
          <div>
            <h2 className="font-display text-2xl font-normal text-ic-ink mb-4">Rooms</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {visibleRooms.map((r) => (
                <Link
                  key={r.roomId}
                  href={`/rooms/${r.roomId}`}
                  className="bg-ic-card border border-ic-rule rounded-xl p-4 hover:border-ic-accent transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    {r.roomCategory && (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-mono text-[10px] font-medium tracking-wide ${catClass(r.roomCategory)}`}>
                        <span className="w-1 h-1 rounded-[1px] bg-current opacity-[0.55]" />
                        {r.roomCategory}
                      </span>
                    )}
                    {r.roomVisibility === "private" && (
                      <Lock size={11} className="text-ic-muted shrink-0 ml-auto" />
                    )}
                  </div>
                  <h3 className="font-display text-base text-ic-ink truncate">{r.roomName}</h3>
                  <p className="font-mono text-[10px] text-ic-muted mt-1 capitalize">{r.role}</p>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
