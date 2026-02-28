import { db } from "@/db";
import { users, ideas } from "@/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import { Trophy, TrendingUp, ShieldCheck } from "lucide-react";

export default async function LeaderboardPage() {
  const topVisionaries = await db
    .select({
      id: users.id,
      name: users.name,
      handle: users.handle,
      tier: users.tier,
      ideaCount: sql<number>`count(${ideas.id})`.as("idea_count"),
      totalLikes: sql<number>`coalesce(sum(${ideas.totalLikes}), 0)`.as("total_likes"),
    })
    .from(users)
    .leftJoin(ideas, eq(ideas.userId, users.id))
    .groupBy(users.id)
    .orderBy(desc(sql`total_likes`))
    .limit(10);

  return (
    <div className="min-h-screen bg-[#f8fafb] p-8">
      <div className="max-w-4xl mx-auto">
        <header className="mb-12">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-[#0d9488]/10 rounded-xl">
              <Trophy className="text-[#0d9488]" size={22} />
            </div>
            <p className="text-sm font-semibold text-[#0d9488] uppercase tracking-widest">Rankings</p>
          </div>
          <h1 className="text-4xl font-bold text-slate-900 tracking-tight" style={{ fontFamily: 'var(--font-playfair)' }}>
            Top Visionaries
          </h1>
          <p className="text-slate-500 mt-1">Ranked by total likes across all published ideas.</p>
        </header>

        <div className="bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 text-xs uppercase tracking-widest bg-slate-50">
                <th className="p-5 font-semibold">Rank</th>
                <th className="p-5 font-semibold">Visionary</th>
                <th className="p-5 font-semibold">Tier</th>
                <th className="p-5 font-semibold text-center">Ideas</th>
                <th className="p-5 font-semibold text-right text-[#0d9488]">Total Likes</th>
              </tr>
            </thead>
            <tbody>
              {topVisionaries.map((user, index) => (
                <tr key={user.id} className="group hover:bg-teal-50/50 transition-colors border-b border-slate-50 last:border-0">
                  <td className="p-5">
                    <span className={`text-xl font-bold font-mono ${index < 3 ? 'text-[#0d9488]' : 'text-slate-300'}`}>
                      {index + 1}
                    </span>
                  </td>
                  <td className="p-5">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-[#0d9488]/10 border border-[#0d9488]/20 flex items-center justify-center font-bold text-[#0d9488] text-sm">
                        {(user.name ?? user.id)[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">{user.name ?? user.id}</p>
                        {index === 0 && (
                          <span className="text-[10px] bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full font-bold uppercase border border-amber-200">
                            Top Visionary
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="p-5">
                    <div className="flex items-center gap-1.5">
                      <ShieldCheck size={13} className="text-slate-400" />
                      <span className="text-sm font-medium text-slate-500">{user.tier ?? "Beginner"}</span>
                    </div>
                  </td>
                  <td className="p-5 text-center text-slate-500 font-medium">{Number(user.ideaCount)}</td>
                  <td className="p-5 text-right">
                    <span className="text-xl font-bold text-[#0d9488]">
                      {Number(user.totalLikes).toLocaleString()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {topVisionaries.length === 0 && (
            <div className="p-16 text-center text-slate-400 italic" style={{ fontFamily: 'var(--font-playfair)' }}>
              No data yet. Be the first to launch an idea!
            </div>
          )}
        </div>

        <div className="mt-8 p-6 bg-white border border-slate-100 rounded-2xl shadow-sm">
          <TrendingUp size={18} className="text-[#0d9488] mb-2" />
          <h4 className="font-semibold text-slate-900 text-sm">How to rank up</h4>
          <p className="text-xs text-slate-500 mt-1">Post public ideas and earn likes from the community. The more engagement your ideas get, the higher you climb.</p>
        </div>
      </div>
    </div>
  );
}
