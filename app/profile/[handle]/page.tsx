import { db } from "@/db";
import { ideas, users } from "@/db/schema";
import { eq, desc, sql, or } from "drizzle-orm";
import { notFound } from "next/navigation";
import IdeaCard from "@/components/IdeaCard";
import { getTier, getTierProgress } from "@/lib/tier-engine";
import { User, Award, Briefcase, TrendingUp } from "lucide-react";
import { Suspense } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Tab Content Components
// ─────────────────────────────────────────────────────────────────────────────

async function MyGenesisTab({ userId }: { userId: string }) {
  const userIdeas = await db
    .select({
      id: ideas.id,
      userId: ideas.userId,
      title: ideas.title,
      hook: ideas.hook,
      content: ideas.content,
      category: ideas.category,
      status: ideas.status,
      totalLikes: ideas.totalLikes,
      views: ideas.views,
      blurLevel: ideas.blurLevel,
      genesisHash: ideas.genesisHash,
      simHash: ideas.simHash,
      viewerIds: ideas.viewerIds,
      partnerIds: ideas.partnerIds,
      aiMetadata: ideas.aiMetadata,
      createdAt: ideas.createdAt,
      updatedAt: ideas.updatedAt,
      author: {
        id: users.id,
        name: users.name,
        handle: users.handle,
        image: users.image,
        tier: users.tier,
      },
    })
    .from(ideas)
    .leftJoin(users, eq(ideas.userId, users.id))
    .where(eq(ideas.userId, userId))
    .orderBy(desc(ideas.createdAt));

  if (userIdeas.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        <p className="text-sm">No genesis ideas yet</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {userIdeas.map((item) => (
        <IdeaCard
          key={item.id}
          idea={{
            id: item.id,
            userId: item.userId,
            title: item.title,
            hook: item.hook,
            content: item.content,
            category: item.category,
            status: item.status,
            totalLikes: item.totalLikes,
            views: item.views,
            blurLevel: item.blurLevel,
            genesisHash: item.genesisHash,
            simHash: item.simHash,
            viewerIds: item.viewerIds || [],
            partnerIds: item.partnerIds || [],
            aiMetadata: item.aiMetadata,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt,
          }}
          author={item.author}
          viewerId="user_test_123"
        />
      ))}
    </div>
  );
}

async function PartneredTab({ userId }: { userId: string }) {
  // Find ideas where user is in partnerIds array
  const partneredIdeas = await db
    .select({
      id: ideas.id,
      userId: ideas.userId,
      title: ideas.title,
      hook: ideas.hook,
      content: ideas.content,
      category: ideas.category,
      status: ideas.status,
      totalLikes: ideas.totalLikes,
      views: ideas.views,
      blurLevel: ideas.blurLevel,
      genesisHash: ideas.genesisHash,
      simHash: ideas.simHash,
      viewerIds: ideas.viewerIds,
      partnerIds: ideas.partnerIds,
      aiMetadata: ideas.aiMetadata,
      createdAt: ideas.createdAt,
      updatedAt: ideas.updatedAt,
      author: {
        id: users.id,
        name: users.name,
        handle: users.handle,
        image: users.image,
        tier: users.tier,
      },
    })
    .from(ideas)
    .leftJoin(users, eq(ideas.userId, users.id))
    .where(sql`${userId} = ANY(${ideas.partnerIds})`)
    .orderBy(desc(ideas.createdAt));

  if (partneredIdeas.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        <p className="text-sm">No partnerships yet</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {partneredIdeas.map((item) => (
        <IdeaCard
          key={item.id}
          idea={{
            id: item.id,
            userId: item.userId,
            title: item.title,
            hook: item.hook,
            content: item.content,
            category: item.category,
            status: item.status,
            totalLikes: item.totalLikes,
            views: item.views,
            blurLevel: item.blurLevel,
            genesisHash: item.genesisHash,
            simHash: item.simHash,
            viewerIds: item.viewerIds || [],
            partnerIds: item.partnerIds || [],
            aiMetadata: item.aiMetadata,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt,
          }}
          author={item.author}
          viewerId="user_test_123"
        />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Profile Page
// ─────────────────────────────────────────────────────────────────────────────

export default async function ProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ handle: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  // ── Await params (Next.js 16 requirement) ────────────────────────────────
  const resolvedParams = await params;
  const { handle } = resolvedParams;

  const resolvedSearchParams = await searchParams;
  const activeTab = resolvedSearchParams.tab || "genesis";

  // Fetch user by handle
  const [profileUser] = await db
    .select()
    .from(users)
    .where(eq(users.handle, handle));

  if (!profileUser) {
    notFound();
  }

  // Get tier info
  const tier = getTier(profileUser.xp);
  const progress = getTierProgress(profileUser.xp);

  // Get stats
  const [genesisCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(ideas)
    .where(eq(ideas.userId, profileUser.id));

  const [partnershipCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(ideas)
    .where(sql`${profileUser.id} = ANY(${ideas.partnerIds})`);

  const stats = {
    genesisIdeas: Number(genesisCount?.count || 0),
    partnerships: Number(partnershipCount?.count || 0),
    totalXp: profileUser.xp,
  };

  return (
    <div className="min-h-screen bg-[#f8fafb] p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header Section */}
        <div className="bg-white rounded-3xl border border-slate-100 p-8 mb-8">
          {/* Avatar & Name */}
          <div className="flex items-start gap-6 mb-6">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#0d9488] to-teal-600 flex items-center justify-center text-white text-3xl font-bold shadow-lg">
              {profileUser.name?.charAt(0).toUpperCase() || "U"}
            </div>
            <div className="flex-1">
              <h1
                className="text-3xl font-bold text-slate-900 mb-1"
                style={{ fontFamily: "var(--font-playfair)" }}
              >
                {profileUser.name || "Anonymous"}
              </h1>
              <p className="text-slate-500 text-sm mb-3">@{profileUser.handle}</p>
              {profileUser.bio && (
                <p className="text-slate-600 text-sm max-w-2xl">{profileUser.bio}</p>
              )}
            </div>

            {/* Tier Badge */}
            <div
              className={`flex flex-col items-center gap-2 px-6 py-4 rounded-2xl border-2 ${tier.borderColor} ${tier.bgColor}`}
            >
              <span className="text-3xl">{tier.icon}</span>
              <span className={`text-sm font-bold uppercase tracking-wider ${tier.color}`}>
                {tier.displayName}
              </span>
              <span className="text-xs text-slate-500">{profileUser.xp} XP</span>
            </div>
          </div>

          {/* XP Progress Bar */}
          {progress.next && (
            <div className="mb-6">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-semibold text-slate-600">
                  Progress to {progress.next.displayName}
                </span>
                <span className="text-xs text-slate-500">
                  {progress.xpToNext} XP to go
                </span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full bg-gradient-to-r ${tier.gradient} transition-all duration-500`}
                  style={{ width: `${progress.progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 bg-slate-50 rounded-xl border border-slate-100">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Briefcase size={16} className="text-[#0d9488]" />
                <span className="text-2xl font-black text-slate-900">
                  {stats.genesisIdeas}
                </span>
              </div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Genesis Ideas
              </p>
            </div>

            <div className="text-center p-4 bg-slate-50 rounded-xl border border-slate-100">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Award size={16} className="text-[#0d9488]" />
                <span className="text-2xl font-black text-slate-900">
                  {stats.partnerships}
                </span>
              </div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Partnerships
              </p>
            </div>

            <div className="text-center p-4 bg-slate-50 rounded-xl border border-slate-100">
              <div className="flex items-center justify-center gap-2 mb-2">
                <TrendingUp size={16} className="text-[#0d9488]" />
                <span className="text-2xl font-black text-slate-900">
                  {stats.totalXp}
                </span>
              </div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Total XP
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6">
          <div className="flex gap-2 border-b border-slate-200">
            <a
              href={`/profile/${handle}?tab=genesis`}
              className={`px-6 py-3 text-sm font-bold transition-colors border-b-2 ${activeTab === "genesis"
                ? "text-[#0d9488] border-[#0d9488]"
                : "text-slate-500 border-transparent hover:text-slate-700"
                }`}
            >
              My Genesis
            </a>
            <a
              href={`/profile/${handle}?tab=partnered`}
              className={`px-6 py-3 text-sm font-bold transition-colors border-b-2 ${activeTab === "partnered"
                ? "text-[#0d9488] border-[#0d9488]"
                : "text-slate-500 border-transparent hover:text-slate-700"
                }`}
            >
              Partnered Ideas
            </a>
          </div>
        </div>

        {/* Tab Content */}
        <Suspense
          fallback={
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="bg-white rounded-3xl p-6 animate-pulse h-64"
                />
              ))}
            </div>
          }
        >
          {activeTab === "genesis" && <MyGenesisTab userId={profileUser.id} />}
          {activeTab === "partnered" && <PartneredTab userId={profileUser.id} />}
        </Suspense>
      </div>
    </div>
  );
}
