import { db } from "@/db";
import { users, ideas } from "@/db/schema";
import { desc, eq, sql, and, gt } from "drizzle-orm";
import {
  Trophy, Zap, Clock, Calendar, Lightbulb, Users, TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { getTierFromXp } from "@/lib/tier-engine";

// v12: Infinity icon removed (not in lucide set used here) — replaced with text
type Tab = "creators" | "ideas";
type Range = "alltime" | "monthly" | "weekly" | "daily";

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; range?: string }>;
}) {
  const p = await searchParams;
  const tab = (p.tab ?? "creators") as Tab;
  const range = (p.range ?? "alltime") as Range;

  const intervalMap: Record<Range, string | null> = {
    daily: "1 day",
    weekly: "7 days",
    monthly: "30 days",
    alltime: null,
  };
  const interval = intervalMap[range] ?? null;

  // v12: status = "published" (not "public")
  const topCreators =
    tab === "creators"
      ? await db
          .select({
            id: users.id,
            name: users.name,
            handle: users.handle,
            xp: users.xp,
            tier: users.tier,
            ideaCount: sql<number>`cast(count(${ideas.id}) as int)`,
            totalLikes: sql<number>`cast(coalesce(sum(${ideas.totalLikes}), 0) as int)`,
          })
          .from(users)
          .innerJoin(
            ideas,
            and(
              eq(ideas.userId, users.id),
              eq(ideas.status, "published"),
              interval
                ? sql`${ideas.createdAt} > now() - interval '${sql.raw(interval)}'`
                : undefined
            )
          )
          .groupBy(users.id)
          .having(gt(sql<number>`cast(count(${ideas.id}) as int)`, 0))
          .orderBy(desc(sql`coalesce(sum(${ideas.totalLikes}), 0)`))
          .limit(20)
      : [];

  // v12: flair column removed — select without it
  const topIdeas =
    tab === "ideas"
      ? await db
          .select({
            id: ideas.id,
            title: ideas.title,
            category: ideas.category,
            totalLikes: ideas.totalLikes,
            views: ideas.views,
            createdAt: ideas.createdAt,
            editorsPick: ideas.editorsPick,
            userId: ideas.userId,
            userName: users.name,
            userHandle: users.handle,
            userXp: users.xp,
          })
          .from(ideas)
          .leftJoin(users, eq(ideas.userId, users.id))
          .where(
            and(
              eq(ideas.status, "published"),
              interval
                ? sql`${ideas.createdAt} > now() - interval '${sql.raw(interval)}'`
                : undefined
            )
          )
          .orderBy(desc(ideas.totalLikes))
          .limit(20)
      : [];

  const mainTabs = [
    { key: "creators", label: "Creators", icon: <Users size={13} /> },
    { key: "ideas", label: "Ideas", icon: <Lightbulb size={13} /> },
  ];

  const rangeTabs: { key: Range; label: string; icon: React.ReactNode }[] = [
    { key: "alltime", label: "All-Time", icon: <span className="text-xs">∞</span> },
    { key: "monthly", label: "Monthly", icon: <TrendingUp size={13} /> },
    { key: "weekly", label: "Weekly", icon: <Calendar size={13} /> },
    { key: "daily", label: "Daily", icon: <Clock size={13} /> },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-white px-6 py-10">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
            <Trophy size={20} className="text-amber-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">The Architect&apos;s Podium</h1>
            <p className="text-slate-400 text-sm">XP unified across Genesis Vault and Idea Commons</p>
          </div>
        </div>

        {/* Tab + Range controls */}
        <div className="flex flex-wrap gap-3 mb-8">
          <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1">
            {mainTabs.map((t) => (
              <Link
                key={t.key}
                href={`/leaderboard?tab=${t.key}&range=${range}`}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold transition-all
                  ${tab === t.key
                    ? "bg-[#0d9488] text-white"
                    : "text-slate-400 hover:text-white"
                  }`}
              >
                {t.icon} {t.label}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1">
            {rangeTabs.map((t) => (
              <Link
                key={t.key}
                href={`/leaderboard?tab=${tab}&range=${t.key}`}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all
                  ${range === t.key
                    ? "bg-slate-700 text-white"
                    : "text-slate-500 hover:text-white"
                  }`}
              >
                {t.icon} {t.label}
              </Link>
            ))}
          </div>
        </div>

        {/* CREATORS TABLE */}
        {tab === "creators" && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-500 text-xs uppercase tracking-widest bg-slate-950/50">
                  <th className="p-5 font-semibold w-14">Rank</th>
                  <th className="p-5 font-semibold">Creator</th>
                  <th className="p-5 font-semibold">Tier</th>
                  <th className="p-5 font-semibold text-center">XP</th>
                  <th className="p-5 font-semibold text-center">Ideas</th>
                  <th className="p-5 font-semibold text-right text-[#0d9488]">Sparks</th>
                </tr>
              </thead>
              <tbody>
                {topCreators.map((user, i) => {
                  const tier = getTierFromXp(user.xp ?? 0);
                  return (
                    <tr
                      key={user.id}
                      className="group hover:bg-slate-800/50 transition-colors border-b border-slate-800 last:border-0"
                    >
                      <td className="p-5">
                        <span className={`text-xl font-bold font-mono ${
                          i === 0 ? "text-amber-500" :
                          i === 1 ? "text-slate-400" :
                          i === 2 ? "text-orange-400" : "text-slate-600"
                        }`}>{i + 1}</span>
                      </td>
                      <td className="p-5">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm ${tier.bgColor} ${tier.color}`}>
                            {(user.name ?? user.id)[0].toUpperCase()}
                          </div>
                          <div>
                            <Link
                              href={`/profile/${user.handle ?? user.id}`}
                              className="font-semibold text-white hover:text-[#0d9488] transition-colors"
                            >
                              {user.handle ? `@${user.handle}` : user.name ?? user.id}
                            </Link>
                            {i === 0 && (
                              <span className="block text-[10px] bg-amber-900/40 text-amber-400 px-2 py-0.5 rounded-full font-bold uppercase border border-amber-800 w-fit mt-0.5">
                                Top Creator
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="p-5">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full border ${tier.color} ${tier.bgColor}`}>
                          {tier.displayName}
                        </span>
                      </td>
                      <td className="p-5 text-center">
                        <span className="flex items-center justify-center gap-1 text-sm font-bold text-violet-400">
                          <Zap size={12} className="fill-violet-400" />
                          {(user.xp ?? 0).toLocaleString()}
                        </span>
                      </td>
                      <td className="p-5 text-center text-slate-400 font-medium">{user.ideaCount}</td>
                      <td className="p-5 text-right">
                        <span className="text-xl font-bold text-[#0d9488]">
                          {user.totalLikes.toLocaleString()}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {topCreators.length === 0 && <EmptyState />}
          </div>
        )}

        {/* IDEAS TABLE */}
        {tab === "ideas" && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-500 text-xs uppercase tracking-widest bg-slate-950/50">
                  <th className="p-5 font-semibold w-14">Rank</th>
                  <th className="p-5 font-semibold">Idea</th>
                  <th className="p-5 font-semibold">Creator</th>
                  <th className="p-5 font-semibold text-center">Views</th>
                  <th className="p-5 font-semibold text-right text-[#0d9488]">Sparks</th>
                </tr>
              </thead>
              <tbody>
                {topIdeas.map((idea, i) => {
                  const tier = getTierFromXp(idea.userXp ?? 0);
                  return (
                    <tr
                      key={idea.id}
                      className="group hover:bg-slate-800/50 transition-colors border-b border-slate-800 last:border-0"
                    >
                      <td className="p-5">
                        <span className={`text-xl font-bold font-mono ${
                          i === 0 ? "text-amber-500" :
                          i === 1 ? "text-slate-400" :
                          i === 2 ? "text-orange-400" : "text-slate-600"
                        }`}>{i + 1}</span>
                      </td>
                      <td className="p-5">
                        <div className="flex flex-col gap-1">
                          {idea.editorsPick && (
                            <span className="text-[10px] bg-amber-900/40 text-amber-400 px-2 py-0.5 rounded-full font-bold uppercase border border-amber-800 w-fit">
                              Editor&apos;s Pick
                            </span>
                          )}
                          <Link
                            href={`/idea/${idea.id}`}
                            className="font-semibold text-white hover:text-[#0d9488] transition-colors line-clamp-1"
                          >
                            {idea.title}
                          </Link>
                          {idea.category && (
                            <span className="text-xs text-slate-500">{idea.category}</span>
                          )}
                        </div>
                      </td>
                      <td className="p-5">
                        <div className="flex items-center gap-2">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${tier.bgColor} ${tier.color}`}>
                            {(idea.userName ?? idea.userId ?? "?")[0].toUpperCase()}
                          </div>
                          <Link
                            href={`/profile/${idea.userHandle ?? idea.userId}`}
                            className="text-sm text-slate-400 hover:text-[#0d9488] transition-colors"
                          >
                            {idea.userHandle ? `@${idea.userHandle}` : idea.userName ?? "Unknown"}
                          </Link>
                        </div>
                      </td>
                      <td className="p-5 text-center text-slate-400 font-medium">
                        {(idea.views ?? 0).toLocaleString()}
                      </td>
                      <td className="p-5 text-right">
                        <span className="text-xl font-bold text-[#0d9488]">
                          {(idea.totalLikes ?? 0).toLocaleString()}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {topIdeas.length === 0 && <EmptyState />}
          </div>
        )}

        {/* XP info panel */}
        <div className="mt-8 p-6 bg-slate-900 border border-slate-800 rounded-2xl">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={16} className="text-[#0d9488]" />
            <h4 className="font-bold text-white text-sm">How XP &amp; Tiers work</h4>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-slate-400 mt-3">
            {[
              { action: "Launch vault idea", xp: "+50 XP" },
              { action: "Post commons idea", xp: "+30 XP" },
              { action: "Receive a spark", xp: "+5 XP" },
              { action: "Delete idea", xp: "−10 XP" },
            ].map((row) => (
              <div key={row.action} className="bg-slate-800 rounded-xl p-3 border border-slate-700">
                <p className="font-bold text-violet-400">{row.xp}</p>
                <p className="mt-0.5">{row.action}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-500 mt-4">
            Tier ladder:{" "}
            <span className="font-semibold text-slate-400">Starter (0)</span> →{" "}
            <span className="font-semibold text-teal-400">Builder (1,000)</span> →{" "}
            <span className="font-semibold text-violet-400">Architect (5,000)</span> →{" "}
            <span className="font-semibold text-amber-400">Grand Architect (15,000)</span>
          </p>
        </div>

      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="p-16 text-center text-slate-500 italic">
      No data for this period yet. Be the first to launch an idea!
    </div>
  );
}
