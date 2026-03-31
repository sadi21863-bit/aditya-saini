import { db } from "@/db";
import { ideas, users } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "@/lib/auth";
import { redirect } from "next/navigation";
import IdeaCard from "@/components/IdeaCard";
import { getTierFromXp, xpToNextTier, tierProgress } from "@/lib/tier-engine";
import { Zap } from "lucide-react";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  let userId: string;
  try { userId = await requireAuth(); }
  catch { redirect("/sign-in"); }

  const { tab } = await searchParams;
  const activeTab = tab ?? "all";

  const me = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!me?.handle) redirect("/onboarding");

  const allIdeas = await db
    .select()
    .from(ideas)
    .where(eq(ideas.userId, userId))
    .orderBy(desc(ideas.createdAt));

  // FIX v12: was filtering by status === "public" — v12/v13 uses "published"
  const filtered =
    activeTab === "drafts"
      ? allIdeas.filter((i) => i.status === "draft")
      : activeTab === "launched"
        ? allIdeas.filter((i) => i.status === "published")
        : allIdeas;

  const tier = getTierFromXp(me.xp ?? 0);
  const progress = tierProgress(me.xp ?? 0);
  const xpToNext = xpToNextTier(me.xp ?? 0);

  const tabs = [
    { key: "all",      label: `All (${allIdeas.length})` },
    { key: "drafts",   label: `Drafts (${allIdeas.filter((i) => i.status === "draft").length})` },
    { key: "launched", label: `Launched (${allIdeas.filter((i) => i.status === "published").length})` },
  ];

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-white">My Workspace</h1>
          <p className="text-slate-400 text-sm mt-1">
            @{me.handle} ·{" "}
            <span className={`font-semibold ${tier.color}`}>{tier.displayName}</span>
          </p>
        </div>
        <a href="/new" className="bg-teal-600 hover:bg-teal-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition">
          + New Idea
        </a>
      </div>

      {/* XP + Tier Progress */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 mb-8">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Zap size={14} className="text-violet-400 fill-violet-400" />
            <span className="text-sm font-bold text-white">{(me.xp ?? 0).toLocaleString()} XP</span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${tier.bgColor} ${tier.color} border ${tier.borderColor ?? "border-slate-700"}`}>
              {tier.displayName}
            </span>
          </div>
          {xpToNext !== null && (
            <span className="text-xs text-slate-500">{xpToNext.toLocaleString()} XP to next tier</span>
          )}
        </div>
        <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-teal-500 to-violet-500 rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-slate-800 pb-2">
        {tabs.map((t) => (
          <a
            key={t.key}
            href={`/dashboard?tab=${t.key}`}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${
              activeTab === t.key
                ? "bg-teal-700 text-white"
                : "text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
          >
            {t.label}
          </a>
        ))}
      </div>

      {/* Ideas list */}
      <div className="flex flex-col gap-4">
        {filtered.length === 0 && (
          <p className="text-slate-500 text-center py-16">
            {activeTab === "drafts" ? "No drafts yet." : activeTab === "launched" ? "No launched ideas yet." : "No ideas yet. Create your first one!"}
          </p>
        )}
        {filtered.map((idea) => (
          <IdeaCard
            key={idea.id}
            idea={idea}
            viewerId={userId}
            isOwner={true}
            showActions={true}
          />
        ))}
      </div>
    </div>
  );
}
