import { db } from "@/db";
import { users, ideas } from "@/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import { Trophy, TrendingUp, ShieldCheck } from "lucide-react";

export default async function LeaderboardPage() {
    // Rank users by how many public ideas they have (real metric from current schema)
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
        <div className="min-h-screen bg-black text-white p-8">
            <div className="max-w-4xl mx-auto">
                <header className="mb-12 text-center">
                    <div className="inline-block p-3 bg-blue-500/10 rounded-2xl mb-4 border border-blue-500/20">
                        <Trophy className="text-blue-500" size={40} />
                    </div>
                    <h1 className="text-5xl font-black tracking-tighter italic">TOP VISIONARIES</h1>
                    <p className="text-slate-500 mt-2 uppercase tracking-[0.3em] text-xs font-bold">
                        Ranked by Total Likes
                    </p>
                </header>

                <div className="bg-slate-900/30 border border-slate-800 rounded-[3rem] overflow-hidden backdrop-blur-md">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-slate-800 text-slate-500 text-[10px] uppercase tracking-widest">
                                <th className="p-6 font-black">Rank</th>
                                <th className="p-6 font-black">Visionary</th>
                                <th className="p-6 font-black">Tier</th>
                                <th className="p-6 font-black text-center">Ideas</th>
                                <th className="p-6 font-black text-right text-blue-500">Total Likes</th>
                            </tr>
                        </thead>
                        <tbody>
                            {topVisionaries.map((user, index) => (
                                <tr key={user.id} className="group hover:bg-blue-500/5 transition-colors border-b border-slate-800/50 last:border-0">
                                    <td className="p-6">
                                        <span className={`text-2xl font-mono font-black ${index < 3 ? 'text-blue-500' : 'text-slate-700'}`}>
                                            {index + 1}
                                        </span>
                                    </td>
                                    <td className="p-6">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-blue-400">
                                                {(user.name ?? user.id)[0].toUpperCase()}
                                            </div>
                                            <div>
                                                <p className="font-bold text-lg">{user.name ?? user.id}</p>
                                                {index === 0 && (
                                                    <span className="text-[10px] bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded-full font-black uppercase">
                                                        Top Visionary
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-6">
                                        <div className="flex items-center gap-2">
                                            <ShieldCheck size={14} className="text-slate-500" />
                                            <span className="font-mono font-bold italic">{user.tier}</span>
                                        </div>
                                    </td>
                                    <td className="p-6 text-center font-mono text-slate-400">
                                        {Number(user.ideaCount)}
                                    </td>
                                    <td className="p-6 text-right">
                                        <span className="text-2xl font-black text-white group-hover:text-blue-400 transition-colors">
                                            {Number(user.totalLikes).toLocaleString()}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-3xl">
                        <TrendingUp size={20} className="text-blue-500 mb-2" />
                        <h4 className="font-bold text-sm">How to Rank Up</h4>
                        <p className="text-xs text-slate-500 mt-1">Post public ideas and earn likes from the community.</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
