import { db } from "@/db";
import { ideas, users } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import IdeaCard from "@/components/IdeaCard";
import Link from "next/link";
import { LayoutDashboard, PlusCircle, Zap, Sparkles } from "lucide-react";
import { getAuthenticatedUserId } from "@/lib/auth";
import { getTier } from "@/lib/tier-engine";

type Tab = "all" | "drafts" | "launched";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const resolvedParams = await searchParams;
  const tab = (resolvedParams.tab ?? "all") as Tab;

  const userId = await getAuthenticatedUserId();

  // ── Fetch based on active tab ──────────────────────────────────────────────
  const whereClause =
    tab === "drafts"
      ? and(eq(ideas.userId, userId), eq(ideas.status, "draft"))
      : tab === "launched"
        ? and(eq(ideas.userId, userId), eq(ideas.status, "public"))
        : eq(ideas.userId, userId);

  const [tabIdeas, allIdeas, userRow] = await Promise.all([
    db.select().from(ideas).where(whereClause).orderBy(desc(ideas.updatedAt)),
    db.select().from(ideas).where(eq(ideas.userId, userId)),
    db.select({ xp: users.xp, tier: users.tier, score: users.score })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1),
  ]);

  const user = userRow[0] ?? null;
  const tierConfig = getTier(user?.xp ?? 0);
  const totalLikes = allIdeas.reduce((s, i) => s + (i.totalLikes ?? 0), 0);
  const draftCount = allIdeas.filter((i) => i.status === "draft").length;
  const publicCount = allIdeas.filter((i) => i.status === "public").length;

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "all", label: "All Ideas", count: allIdeas.length },
    { key: "drafts", label: "Drafts", count: draftCount },
    { key: "launched", label: "Launched", count: publicCount },
  ];

  return (
    <div className="min-h-screen bg-[#f8fafb] p-8">
      <div className="max-w-6xl mx-auto">

        {/* ── HEADER ─────────────────────────────────────────────────────── */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-[#0d9488]/10 rounded-xl">
                <LayoutDashboard className="text-[#0d9488]" size={22} />
              </div>
              <p className="text-sm font-semibold text-[#0d9488] uppercase tracking-widest">
                My Workspace
              </p>
            </div>
            <h1
              className="text-4xl font-bold text-slate-900 tracking-tight"
              style={{ fontFamily: "var(--font-playfair)" }}
            >
              Dashboard
            </h1>
            <p className="text-slate-500 mt-1">Manage all your ideas in one place.</p>
          </div>

          <div className="flex gap-3">
            <Link
              href="/dashboard/studio"
              className="inline-flex items-center gap-2 bg-white border border-slate-200
                text-slate-700 px-5 py-3 rounded-2xl font-bold hover:border-[#0d9488]
                hover:text-[#0d9488] transition-all shadow-sm active:scale-95"
            >
              <Sparkles size={16} /> Studio
            </Link>
            <Link
              href="/new"
              className="inline-flex items-center gap-2 bg-[#0d9488] text-white px-5 py-3
                rounded-2xl font-bold hover:bg-teal-700 transition-all shadow-md active:scale-95"
            >
              <PlusCircle size={16} /> New Idea
            </Link>
          </div>
        </div>

        {/* ── STATS STRIP ────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Total Ideas", value: allIdeas.length, color: "text-slate-900" },
            { label: "Total Likes", value: totalLikes, color: "text-[#0d9488]" },
            { label: "Live in Feed", value: publicCount, color: "text-teal-600" },
          ].map((stat) => (
            <div key={stat.label} className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
              <p
                className={`text-2xl font-bold ${stat.color}`}
                style={{ fontFamily: "var(--font-playfair)" }}
              >
                {stat.value}
              </p>
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mt-1">
                {stat.label}
              </p>
            </div>
          ))}

          {/* XP + Tier card */}
          <div className={`border rounded-2xl p-5 shadow-sm ${tierConfig.bgColor}`}>
            <div className="flex items-center gap-1.5">
              <Zap size={14} className={`${tierConfig.color} fill-current`} />
              <p
                className={`text-2xl font-bold ${tierConfig.color}`}
                style={{ fontFamily: "var(--font-playfair)" }}
              >
                {(user?.xp ?? 0).toLocaleString()}
              </p>
            </div>
            <p className="text-xs font-medium uppercase tracking-wider mt-1 text-slate-500">
              XP · <span className={`font-bold ${tierConfig.color}`}>{tierConfig.displayName}</span>
            </p>
          </div>
        </div>

        {/* ── TAB BAR ────────────────────────────────────────────────────── */}
        <div className="flex gap-2 mb-8 bg-white border border-slate-100 rounded-2xl
          p-1.5 w-fit shadow-sm">
          {tabs.map((t) => (
            <Link
              key={t.key}
              href={`/dashboard?tab=${t.key}`}
              className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all
                flex items-center gap-2 ${tab === t.key
                  ? "bg-[#0d9488] text-white shadow-md"
                  : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                }`}
            >
              {t.label}
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${tab === t.key
                  ? "bg-white/20 text-white"
                  : "bg-slate-100 text-slate-500"
                }`}>
                {t.count}
              </span>
            </Link>
          ))}
        </div>

        {/* ── IDEAS GRID ─────────────────────────────────────────────────── */}
        {tabIdeas.length === 0 ? (
          <div className="border-2 border-dashed border-slate-200 rounded-3xl p-20
            text-center bg-white">
            <p
              className="text-slate-400 text-lg font-medium"
              style={{ fontFamily: "var(--font-playfair)" }}
            >
              {tab === "drafts"
                ? "No drafts yet."
                : tab === "launched"
                  ? "Nothing launched yet. Publish a draft to see it here."
                  : "Your workspace is empty. Create your first idea!"}
            </p>
            <Link
              href="/new"
              className="mt-6 inline-flex items-center gap-2 text-[#0d9488] font-bold hover:underline"
            >
              <PlusCircle size={16} /> Create your first idea
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {tabIdeas.map((idea) => (
              <IdeaCard key={idea.id} idea={idea} showActions />
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
