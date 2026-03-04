// app/profile/[handle]/page.tsx
import { db } from "@/db";
import { users, ideas } from "@/db/schema";
import { eq, or } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Sparkles, Users, Award, UserPlus, UserCheck } from "lucide-react";
import { getTier } from "@/lib/tier-engine";
import { getFollowStats, isFollowing } from "@/app/actions/socialActions";
import FollowButton from "@/components/FollowButton";

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const resolvedParams = await params;
  const handle = resolvedParams.handle;

  // Hardcoded for dev testing
  const currentUserId = "user_test_123";

  // Find user by handle or ID
  const [profileUser] = await db
    .select()
    .from(users)
    .where(or(eq(users.handle, handle), eq(users.id, handle)))
    .limit(1);

  if (!profileUser) {
    notFound();
  }

  // Get tier info
  const tier = getTier(profileUser.xp ?? 0);

  // Get follow stats
  const followStats = await getFollowStats(profileUser.id);
  const followingStatus = await isFollowing(currentUserId, profileUser.id);

  // Get Genesis Ideas (ideas user owns)
  const genesisIdeas = await db
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

  // Get Partnered Ideas (ideas user is partner on)
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

  return (
    <div className="min-h-screen bg-[#f8fafb] p-8">
      <div className="max-w-5xl mx-auto">
        {/* Back Button */}
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-6 font-medium transition-colors"
        >
          <ArrowLeft size={18} />
          Back
        </Link>

        {/* Profile Header */}
        <div className="bg-white rounded-3xl border border-slate-100 p-8 mb-8 shadow-sm">
          <div className="flex items-start gap-6">
            {/* Avatar */}
            <div
              className={`w-24 h-24 rounded-2xl flex items-center justify-center text-4xl font-bold ${tier.bgColor} ${tier.color} border-4 ${tier.borderColor}`}
            >
              {tier.icon}
            </div>

            {/* Info */}
            <div className="flex-1">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h1
                    className="text-3xl font-bold text-slate-900 mb-1"
                    style={{ fontFamily: "var(--font-playfair)" }}
                  >
                    {profileUser.name || "Anonymous"}
                  </h1>
                  <p className="text-slate-500 text-sm mb-3">
                    @{profileUser.handle || profileUser.id}
                  </p>

                  {/* Follow Stats */}
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-slate-900">
                        {followStats.followers}
                      </span>
                      <span className="text-slate-500">Followers</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-slate-900">
                        {followStats.following}
                      </span>
                      <span className="text-slate-500">Following</span>
                    </div>
                  </div>
                </div>

                {/* Right Side: Tier Badge + Follow Button */}
                <div className="flex flex-col items-end gap-3">
                  {/* Tier Badge */}
                  <div
                    className={`px-4 py-2 rounded-xl font-bold text-sm ${tier.bgColor} ${tier.color} border-2 ${tier.borderColor} flex items-center gap-2`}
                  >
                    <span>{tier.icon}</span>
                    <span>{tier.displayName}</span>
                  </div>

                  {/* Follow Button */}
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
              {profileUser.bio && (
                <p className="text-slate-600 mb-4 mt-4">{profileUser.bio}</p>
              )}

              {/* Stats */}
              <div className="flex items-center gap-6 mt-4 pt-4 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  <Sparkles size={18} className="text-[#0d9488]" />
                  <span className="font-bold text-slate-900">
                    {profileUser.xp || 0}
                  </span>
                  <span className="text-slate-500 text-sm">XP</span>
                </div>
                <div className="flex items-center gap-2">
                  <Award size={18} className="text-purple-500" />
                  <span className="font-bold text-slate-900">
                    {genesisIdeas.length}
                  </span>
                  <span className="text-slate-500 text-sm">Genesis Ideas</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users size={18} className="text-amber-500" />
                  <span className="font-bold text-slate-900">
                    {partneredIdeas.length}
                  </span>
                  <span className="text-slate-500 text-sm">Partnerships</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          {/* Tab Headers */}
          <div className="flex border-b border-slate-100">
            <button className="flex-1 px-6 py-4 font-semibold text-sm bg-[#0d9488] text-white flex items-center justify-center gap-2">
              <span>{tier.icon}</span>
              Genesis Ideas ({genesisIdeas.length})
            </button>
            <button className="flex-1 px-6 py-4 font-semibold text-sm text-slate-600 hover:bg-slate-50 transition-colors flex items-center justify-center gap-2">
              <span>🤝</span>
              Partnered Ideas ({partneredIdeas.length})
            </button>
          </div>

          {/* Tab Content - Genesis Ideas */}
          <div className="p-6">
            {genesisIdeas.length === 0 ? (
              <div className="text-center py-12">
                <Sparkles size={48} className="mx-auto text-slate-300 mb-4" />
                <h3 className="text-lg font-bold text-slate-900 mb-2">
                  No Genesis Ideas Yet
                </h3>
                <p className="text-slate-500 text-sm mb-4">
                  {isOwnProfile
                    ? "Start creating your first idea!"
                    : "This user hasn't created any ideas yet."}
                </p>
                {isOwnProfile && (
                  <Link
                    href="/new"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-[#0d9488] text-white rounded-xl font-semibold hover:bg-[#0f766e] transition-colors"
                  >
                    Create Idea
                  </Link>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {genesisIdeas.map((idea) => {
                  const partnerCount = idea.partnerIds?.length || 0;
                  return (
                    <Link
                      key={idea.id}
                      href={`/idea/${idea.id}`}
                      className="group"
                    >
                      <div className="bg-slate-50 rounded-2xl border border-slate-100 p-5 hover:border-[#0d9488] hover:shadow-md transition-all">
                        {/* Status Badge */}
                        <div className="flex items-center justify-between mb-3">
                          <span
                            className={`text-xs font-bold px-3 py-1 rounded-full ${idea.status === "public"
                                ? "bg-teal-50 text-teal-700 border border-teal-200"
                                : "bg-amber-50 text-amber-700 border border-amber-200"
                              }`}
                          >
                            {idea.status === "public" ? "Live" : "Draft"}
                          </span>
                          {idea.category && (
                            <span className="text-xs text-slate-500 font-medium">
                              {idea.category}
                            </span>
                          )}
                        </div>

                        {/* Title */}
                        <h3 className="text-lg font-bold text-slate-900 mb-2 group-hover:text-[#0d9488] transition-colors line-clamp-2">
                          {idea.title}
                        </h3>

                        {/* Hook */}
                        {idea.hook && (
                          <p className="text-sm text-slate-600 mb-3 line-clamp-2">
                            {idea.hook}
                          </p>
                        )}

                        {/* Stats */}
                        <div className="flex items-center gap-4 text-xs text-slate-500">
                          <span>❤️ {idea.totalLikes}</span>
                          <span>👁️ {idea.views}</span>
                          {partnerCount > 0 && (
                            <span className="text-[#0d9488] font-semibold">
                              🤝 {partnerCount} Partners
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Partnered Ideas Section (Below for now) */}
        {partneredIdeas.length > 0 && (
          <div className="mt-8 bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Users size={20} className="text-[#0d9488]" />
              Partnered Ideas ({partneredIdeas.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {partneredIdeas.map((idea) => (
                <Link
                  key={idea.id}
                  href={`/idea/${idea.id}`}
                  className="group"
                >
                  <div className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-2xl border-2 border-amber-200 p-5 hover:border-[#0d9488] hover:shadow-md transition-all">
                    <div className="flex items-center gap-2 mb-3">
                      <Award size={16} className="text-[#0d9488]" />
                      <span className="text-xs font-bold text-[#0d9488]">
                        PARTNER
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 mb-2 group-hover:text-[#0d9488] transition-colors line-clamp-2">
                      {idea.title}
                    </h3>
                    {idea.hook && (
                      <p className="text-sm text-slate-600 line-clamp-2">
                        {idea.hook}
                      </p>
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
