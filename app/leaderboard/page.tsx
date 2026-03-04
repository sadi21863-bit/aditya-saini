import { db } from "@/db";
import { users, ideas } from "@/db/schema";
import { desc, eq, sql, and, gte } from "drizzle-orm";
import { Trophy, TrendingUp, Zap, Clock, Calendar, Infinity } from "lucide-react";
import Link from "next/link";
import { getTierFromXp } from "@/lib/tier-engine";

type Range = "alltime" | "daily" | "weekly";

/**
 * Leaderboard — Daily / Weekly / All-Time
 *
 * Sorting: pure SQL ORDER BY total_likes DESC per your spec.
 * Daily:   WHERE ideas.created_at > NOW() - INTERVAL '1 day'
 * Weekly:  WHERE ideas.created_at > NOW() - INTERVAL '7 days'
 * All-Time: no date filter
 *
 * Users ranked by the SUM of likes on their ideas in the selected window.
 */
export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const resolvedParams = await searchParams;
  const range = (resolvedParams.range ?? "alltime") as Range;

  // ── Build date filter ─────────────────────────────────────────────────────
  const intervalMap: Record<Range, string | null> = {
    daily: "1 day",
    weekly: "7 days",
    alltime: null,
  };
  const interval = intervalMap[range] ?? null;

  // ── Query: join ideas → users, sum likes, filter by date if needed ─────────
  // Using raw SQL for the interval condition so Drizzle doesn't choke on it.
  const topUsers = await db
    .select({
      id: users.id,
      name: users.name,
      handle: users.handle,
      xp: users.xp,
      tier: users.tier,
      score: users.score,
      ideaCount: sql<number>`cast(count(${ideas.id}) as int)`,
      totalLikes: sql<number>`cast(coalesce(sum(${ideas.totalLikes}), 0) as int)`,
    })
    .from(users)
    .leftJoin(
      ideas,
      and(
        eq(ideas.userId, users.id),
        eq(ideas.status, "public"),
        interval
          ? sql`${ideas.createdAt} > now() - interval '${sql.raw(interval)}'`
          : undefined,
      ),
    )
    .groupBy(users.id)
    .orderBy(desc(sql`coalesce(sum(${ideas.totalLikes}), 0)`))
    .limit(20);

  // ── Tab config ───────────────────────────────────────────────────────────
  const tabs: { key: Range; label: string; icon: React.ReactNode }[] = [
    { key: "alltime", label: "All-Time", icon: <Infinity size={13} /> },
    { key: "weekly", label: "Weekly", icon: <Calendar size={13} /> },
    { key: "daily", label: "Daily", icon: <Clock size={13} /> },
  ];

  return (
    <div className="min-h-screen bg-[#f8fafb] p-8">
      <div className="max-w-4xl mx-auto">

        {/* ── HEADER ──────────────────────────────────────────────────────── */}
        <header className="mb-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-[#0d9488]/10 rounded-xl">
              <Trophy className="text-[#0d9488]" size={22} />
            </div>
            <p className="text-sm font-semibold text-[#0d9488] uppercase tracking-widest">Rankings</p>
          </div>
          <h1
            className="text-4xl font-bold text-slate-900 tracking-tight"
            style={{ fontFamily: "var(--font-playfair)" }}
          >
            Leaderboard
          </h1>
          <p className="text-slate-500 mt-1">Ranked by total likes in the selected window.</p>
        </header>

        {/* ── RANGE TABS ──────────────────────────────────────────────────── */}
        <div className="flex gap-2 mb-8 bg-white border border-slate-100 rounded-2xl p-1.5 w-fit shadow-sm">
          {tabs.map((t) => (
            <Link
              key={t.key}
              href={`/leaderboard?range=${t.key}`}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${range === t.key
                ? "bg-[#0d9488] text-white shadow-md"
                : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                }`}
            >
              {t.icon}
              {t.label}
            </Link>
          ))}
        </div>

        {/* ── TABLE ───────────────────────────────────────────────────────── */}
        <div className="bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 text-xs uppercase tracking-widest bg-slate-50">
                <th className="p-5 font-semibold w-14">Rank</th>
                <th className="p-5 font-semibold">Creator</th>
                <th className="p-5 font-semibold">Tier</th>
                <th className="p-5 font-semibold text-center">XP</th>
                <th className="p-5 font-semibold text-center">Ideas</th>
                <th className="p-5 font-semibold text-right text-[#0d9488]">
                  Likes {range !== "alltime" && `(${range})`}
                </th>
              </tr>
            </thead>
            <tbody>
              {topUsers.map((user, index) => {
                // Derive tier from live XP — never trust cached string alone
                const tierConfig = getTierFromXp(user.xp ?? 0);

                return (
                  <tr
                    key={user.id}
                    className="group hover:bg-teal-50/50 transition-colors border-b border-slate-50 last:border-0"
                  >
                    {/* Rank */}
                    <td className="p-5">
                      <span className={`text-xl font-bold font-mono ${index === 0 ? "text-amber-500" :
                        index === 1 ? "text-slate-400" :
                          index === 2 ? "text-orange-400" :
                            "text-slate-300"
                        }`}>
                        {index + 1}
                      </span>
                    </td>

                    {/* Creator */}
                    <td className="p-5">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center
                          font-bold text-sm border ${tierConfig.bg} ${tierConfig.color} border-current/20`}>
                          {(user.name ?? user.id)[0].toUpperCase()}
                        </div>
                        <div>
                          <Link
                            href={`/profile/${user.handle ?? user.id}`}
                            className="font-semibold text-slate-900 hover:text-[#0d9488] transition-colors"
                          >
                            {user.handle ? `@${user.handle}` : (user.name ?? user.id)}
                          </Link>
                          {index === 0 && (
                            <span className="block text-[10px] bg-amber-50 text-amber-600 px-2 py-0.5
                              rounded-full font-bold uppercase border border-amber-200 w-fit mt-0.5">
                              Top Creator
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Tier — derived from XP */}
                    <td className="p-5">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1
                        rounded-full border ${tierConfig.color} ${tierConfig.bg}`}>
                        {tierConfig.label}
                      </span>
                    </td>

                    {/* XP */}
                    <td className="p-5 text-center">
                      <span className="flex items-center justify-center gap-1 text-sm font-bold text-violet-600">
                        <Zap size={12} className="fill-violet-400" />
                        {(user.xp ?? 0).toLocaleString()}
                      </span>
                    </td>

                    {/* Idea count */}
                    <td className="p-5 text-center text-slate-500 font-medium">
                      {user.ideaCount}
                    </td>

                    {/* Total likes */}
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

          {topUsers.length === 0 && (
            <div
              className="p-16 text-center text-slate-400 italic"
              style={{ fontFamily: "var(--font-playfair)" }}
            >
              No data for this period yet. Be the first to launch an idea!
            </div>
          )}
        </div>

        {/* ── XP GUIDE ────────────────────────────────────────────────────── */}
        <div className="mt-8 p-6 bg-white border border-slate-100 rounded-2xl shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={16} className="text-[#0d9488]" />
            <h4 className="font-bold text-slate-900 text-sm">How XP & Tiers work</h4>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-slate-500 mt-3">
            {[
              { action: "Launch idea", xp: "+10 XP" },
              { action: "Receive a like", xp: "+5 XP" },
              { action: "Contributor tag", xp: "+25 XP" },
              { action: "Delete idea", xp: "−10 XP" },
            ].map((row) => (
              <div key={row.action} className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                <p className="font-bold text-violet-600">{row.xp}</p>
                <p className="mt-0.5">{row.action}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-400 mt-4">
            Tier ladder: <span className="font-semibold text-slate-600">Dreamer (0)</span> →{" "}
            <span className="font-semibold text-teal-600">Visionary (100)</span> →{" "}
            <span className="font-semibold text-violet-600">Architect (500)</span> →{" "}
            <span className="font-semibold text-amber-600">Oracle (2000)</span>
          </p>
        </div>

      </div>
    </div>
  );
}
