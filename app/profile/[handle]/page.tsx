// app/profile/[handle]/page.tsx
import { db } from "@/db";
import { users, ideas } from "@/db/schema";
import { eq, or } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Sparkles,
  Users,
  Award,
  Lightbulb,
  Eye,
  Heart,
  PlusCircle,
  CalendarDays,
} from "lucide-react";
import { getTier } from "@/lib/tier-engine";
import { getFollowStats, isFollowing } from "@/app/actions/socialActions";
import { getDevUserId } from "@/lib/auth";
import FollowButton from "@/components/FollowButton";

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const resolvedParams = await params;
  const handle = resolvedParams.handle;

  const currentUserId = await getDevUserId();

  const [profileUser] = await db
    .select()
    .from(users)
    .where(or(eq(users.handle, handle), eq(users.id, handle)))
    .limit(1);

  if (!profileUser) notFound();

  const tier = getTier(profileUser.xp ?? 0);
  const followStats = await getFollowStats(profileUser.id);
  const followingStatus = await isFollowing(currentUserId, profileUser.id);

  const myIdeas = await db
    .select({
      id: ideas.id,
      title: ideas.title,
      hook: ideas.hook,
      category: ideas.category,
      status: ideas.status,
      totalLikes: ideas.totalLikes,
      views: ideas.views,
      partnerIds: ideas.partnerIds,
      createdAt: ideas.createdAt,
    })
    .from(ideas)
    .where(eq(ideas.userId, profileUser.id));

  const allIdeas = await db
    .select({
      id: ideas.id,
      title: ideas.title,
      hook: ideas.hook,
      category: ideas.category,
      status: ideas.status,
      totalLikes: ideas.totalLikes,
      views: ideas.views,
      partnerIds: ideas.partnerIds,
      userId: ideas.userId,
      createdAt: ideas.createdAt,
    })
    .from(ideas);

  const partneredIdeas = allIdeas.filter(
    (idea) =>
      idea.partnerIds?.includes(profileUser.id) &&
      idea.userId !== profileUser.id
  );

  const isOwnProfile = currentUserId === profileUser.id;
  const joinedYear = profileUser.createdAt
    ? new Date(profileUser.createdAt).getFullYear()
    : null;

  return (
    <div className="min-h-screen bg-[#f8fafb]">
      {/* Cover Banner */}
      <div
        className={`h-40 w-full ${tier.bgColor} opacity-30`}
        style={{
          background: `linear-gradient(135deg, #0d948820 0%, #6366f120 50%, #f59e0b20 100%)`,
        }}
      />

      <div className="max-w-5xl mx-auto px-6 pb-12 -mt-20">
        {/* Back */}
        <Link
          href="/feed"
          className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-6 font-medium transition-colors bg-white/80 backdrop-blur px-3 py-1.5 rounded-xl border border-slate-200 text-sm"
        >
          <ArrowLeft size={15} /> Back to Feed
        </Link>

        {/* Profile Card */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8 mb-6">
          <div className="flex flex-col sm:flex-row items-start gap-6">
            {/* Avatar */}
            <div
              className={`w-24 h-24 rounded-2xl flex items-center justify-center text-4xl font-bold shrink-0 shadow-md
                ${tier.bgColor} ${tier.color} border-4 ${tier.borderColor}`}
            >
              {profileUser.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profileUser.image}
                  alt={profileUser.name || "Avatar"}
                  className="w-full h-full object-cover rounded-xl"
                />
              ) : (
                tier.icon
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
                <div>
                  <h1
                    className="text-3xl font-bold text-slate-900 leading-tight"
                    style={{ fontFamily: "var(--font-playfair)" }}
                  >
                    {profileUser.name || "Anonymous"}
                  </h1>
                  <p className="text-slate-400 text-sm mt-0.5">
                    @{profileUser.handle || profileUser.id}
                  </p>
                </div>

                <div className="flex flex-col items-end gap-2">
                  {/* Tier Badge */}
                  <div
                    className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5
                      ${tier.bgColor} ${tier.color} border ${tier.borderColor}`}
                  >
                    <span>{tier.icon}</span>
                    <span>{tier.displayName}</span>
                  </div>
                  {!isOwnProfile && (
                    <FollowButton
                      currentUserId={currentUserId}
                      targetUserId={profileUser.id}
                      targetHandle={profileUser.handle || profileUser.id}
                      initialIsFollowing={followingStatus.isFollowing}
                      size="md"
                      variant="default"
                    />
                  )}
                </div>
              </div>

              {/* Bio */}
              {profileUser.bio ? (
                <p className="text-slate-600 text-sm leading-relaxed mt-3 max-w-xl">
                  {profileUser.bio}
                </p>
              ) : isOwnProfile ? (
                <p className="text-slate-400 text-sm italic mt-3">
                  No bio yet — add one from your settings.
                </p>
              ) : null}

              {/* Meta row */}
              <div className="flex flex-wrap items-center gap-4 mt-4 text-sm text-slate-500">
                {joinedYear && (
                  <span className="flex items-center gap-1.5">
                    <CalendarDays size={13} /> Joined {joinedYear}
                  </span>
                )}
                <span className="flex items-center gap-1.5 font-semibold text-slate-700">
                  {followStats.followers}
                  <span className="font-normal text-slate-500">Followers</span>
                </span>
                <span className="flex items-center gap-1.5 font-semibold text-slate-700">
                  {followStats.following}
                  <span className="font-normal text-slate-500">Following</span>
                </span>
              </div>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-slate-100">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <Sparkles size={15} className="text-[#0d9488]" />
                <span className="text-xl font-bold text-slate-900">
                  {profileUser.xp || 0}
                </span>
              </div>
              <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold">XP</p>
            </div>
            <div className="text-center border-x border-slate-100">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <Lightbulb size={15} className="text-indigo-500" />
                <span className="text-xl font-bold text-slate-900">
                  {myIdeas.length}
                </span>
              </div>
              <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold">Ideas</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <Users size={15} className="text-amber-500" />
                <span className="text-xl font-bold text-slate-900">
                  {partneredIdeas.length}
                </span>
              </div>
              <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold">Partnerships</p>
            </div>
          </div>
        </div>

        {/* My Ideas Section */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden mb-6">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Lightbulb size={16} className="text-[#0d9488]" />
              My Ideas
              <span className="text-xs font-semibold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                {myIdeas.length}
              </span>
            </h2>
            {isOwnProfile && (
              <Link
                href="/new"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0d9488]
                  hover:bg-[#0d9488]/10 px-3 py-1.5 rounded-xl transition-all"
              >
                <PlusCircle size={13} /> New Idea
              </Link>
            )}
          </div>

          <div className="p-6">
            {myIdeas.length === 0 ? (
              <div className="text-center py-12">
                <Lightbulb size={40} className="mx-auto text-slate-200 mb-3" />
                <h3 className="text-base font-bold text-slate-700 mb-1">
                  No ideas yet
                </h3>
                <p className="text-slate-400 text-sm mb-4">
                  {isOwnProfile
                    ? "Start sharing your first idea with the community."
                    : "This user hasn't shared any ideas yet."}
                </p>
                {isOwnProfile && (
                  <Link
                    href="/new"
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#0d9488] text-white
                      rounded-xl font-semibold text-sm hover:bg-[#0f766e] transition-colors"
                  >
                    <PlusCircle size={14} /> Create Idea
                  </Link>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {myIdeas.map((idea) => (
                  <Link key={idea.id} href={`/idea/${idea.id}`} className="group">
                    <div className="bg-slate-50 rounded-2xl border border-slate-100 p-5
                      hover:border-[#0d9488]/40 hover:shadow-md transition-all">
                      <div className="flex items-center justify-between mb-3">
                        <span
                          className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                            idea.status === "public"
                              ? "bg-teal-50 text-teal-700 border border-teal-200"
                              : "bg-amber-50 text-amber-700 border border-amber-200"
                          }`}
                        >
                          {idea.status === "public" ? "Live" : "Draft"}
                        </span>
                        {idea.category && (
                          <span className="text-xs text-slate-400 font-medium">
                            {idea.category}
                          </span>
                        )}
                      </div>
                      <h3 className="text-base font-bold text-slate-900 mb-1.5
                        group-hover:text-[#0d9488] transition-colors line-clamp-2">
                        {idea.title}
                      </h3>
                      {idea.hook && (
                        <p className="text-sm text-slate-500 mb-3 line-clamp-2">
                          {idea.hook}
                        </p>
                      )}
                      <div className="flex items-center gap-3 text-xs text-slate-400">
                        <span className="flex items-center gap-1">
                          <Heart size={11} /> {idea.totalLikes}
                        </span>
                        <span className="flex items-center gap-1">
                          <Eye size={11} /> {idea.views}
                        </span>
                        {(idea.partnerIds?.length ?? 0) > 0 && (
                          <span className="text-[#0d9488] font-semibold">
                            🤝 {idea.partnerIds?.length} Partners
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Partnered Ideas Section */}
        {partneredIdeas.length > 0 && (
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
            <h2 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Users size={16} className="text-amber-500" />
              Partnered Ideas
              <span className="text-xs font-semibold bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full border border-amber-200">
                {partneredIdeas.length}
              </span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {partneredIdeas.map((idea) => (
                <Link key={idea.id} href={`/idea/${idea.id}`} className="group">
                  <div className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-2xl
                    border border-amber-200 p-5 hover:border-[#0d9488] hover:shadow-md transition-all">
                    <div className="flex items-center gap-2 mb-3">
                      <Award size={14} className="text-amber-500" />
                      <span className="text-xs font-bold text-amber-600 uppercase tracking-widest">
                        Partner
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-slate-900 mb-1.5
                      group-hover:text-[#0d9488] transition-colors line-clamp-2">
                      {idea.title}
                    </h3>
                    {idea.hook && (
                      <p className="text-sm text-slate-500 line-clamp-2">{idea.hook}</p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
