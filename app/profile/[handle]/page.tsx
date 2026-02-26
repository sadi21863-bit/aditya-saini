import { db } from "@/db";
import { ideas, users } from "@/db/schema";
import { desc, eq, and } from "drizzle-orm";
import { Box, Globe, Edit3 } from "lucide-react";
import SparkButton from "@/components/SparkButton";
import Link from "next/link";

export default async function ProfilePage({ params }: { params: { handle: string } }) {
    // Try to find user by handle (requires handle column in users table)
    const userResult = await db.select()
        .from(users)
        .where(eq(users.handle, params.handle))
        .limit(1);

    const user = userResult[0];

    if (!user) {
        return (
            <div className="p-20 text-center">
                <p className="font-black text-slate-400 text-2xl">USER_NOT_FOUND</p>
                <p className="text-slate-600 mt-2 text-sm">No user with handle @{params.handle}</p>
                <Link href="/" className="mt-6 inline-block text-blue-400 hover:text-blue-300 font-bold text-sm">
                    ← Back to Feed
                </Link>
            </div>
        );
    }

    const publicIdeas = await db.select()
        .from(ideas)
        .where(and(eq(ideas.userId, user.id), eq(ideas.status, "public")))
        .orderBy(desc(ideas.createdAt));

    const draftIdeas = await db.select()
        .from(ideas)
        .where(and(eq(ideas.userId, user.id), eq(ideas.status, "draft")))
        .orderBy(desc(ideas.createdAt));

    const totalLikes = publicIdeas.reduce((sum, i) => sum + (i.totalLikes ?? 0), 0);

    // Placeholder viewerId - replace with Clerk session
    const viewerId = "user_test_123";

    return (
        <div className="min-h-screen bg-black text-white p-8 font-sans">
            <div className="max-w-5xl mx-auto">

                {/* PROFILE HEADER */}
                <div className="relative bg-slate-900/50 border border-slate-800 rounded-[3rem] p-10 mb-12 overflow-hidden">
                    <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
                        <div className="w-32 h-32 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-4xl font-black border-4 border-black">
                            {(user.name ?? user.id)[0].toUpperCase()}
                        </div>

                        <div className="text-center md:text-left flex-1">
                            <h1 className="text-4xl font-black tracking-tight italic">
                                {user.handle ? `@${user.handle}` : user.name ?? user.id}
                            </h1>
                            <div className="flex flex-wrap justify-center md:justify-start gap-4 mt-3">
                                <span className="flex items-center gap-1 text-blue-400 font-mono text-sm font-bold bg-blue-500/10 px-3 py-1 rounded-full">
                                    TIER: {user.tier ?? "Beginner"}
                                </span>
                                <span className="flex items-center gap-1 text-slate-400 font-mono text-sm font-bold bg-slate-800 px-3 py-1 rounded-full">
                                    ⚡ {totalLikes} TOTAL LIKES
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">

                    {/* PUBLIC IDEAS */}
                    <div>
                        <div className="flex items-center gap-3 mb-6">
                            <Globe size={20} className="text-blue-500" />
                            <h3 className="text-xl font-black italic">PUBLIC IDEAS</h3>
                        </div>
                        <div className="space-y-4">
                            {publicIdeas.length === 0 && (
                                <div className="border border-dashed border-slate-800 rounded-3xl p-10 text-center text-slate-600 italic">
                                    No public ideas yet.
                                </div>
                            )}
                            {publicIdeas.map(idea => (
                                <div key={idea.id} className="bg-slate-900/30 border border-slate-800 p-6 rounded-3xl hover:border-blue-500/30 transition-all">
                                    <h4 className="font-bold text-lg mb-2">{idea.title}</h4>
                                    <p className="text-sm text-slate-500 line-clamp-2 mb-4 italic">"{idea.hook}"</p>
                                    <div className="flex justify-between items-center">
                                        <div className="text-[10px] font-mono text-slate-600">
                                            {idea.category ?? "General"}
                                        </div>
                                        <SparkButton
                                            ideaId={idea.id}
                                            viewerId={viewerId}
                                            initialLikes={idea.totalLikes ?? 0}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* DRAFT IDEAS (HANGAR) */}
                    <div>
                        <div className="flex items-center gap-3 mb-6">
                            <Box size={20} className="text-amber-500" />
                            <h3 className="text-xl font-black italic">THE HANGAR</h3>
                        </div>
                        <div className="space-y-4">
                            {draftIdeas.length === 0 && (
                                <div className="border border-dashed border-slate-800 rounded-3xl p-10 text-center text-slate-600 italic">
                                    Hangar empty.
                                </div>
                            )}
                            {draftIdeas.map(idea => (
                                <div key={idea.id} className="bg-slate-900/20 border border-dashed border-slate-800 p-6 rounded-3xl hover:bg-slate-900/40 transition-all group">
                                    <div className="flex justify-between items-start mb-2">
                                        <h4 className="font-bold text-lg text-slate-400">{idea.title}</h4>
                                        <Edit3 size={16} className="text-slate-600 group-hover:text-amber-500 cursor-pointer" />
                                    </div>
                                    <span className="text-[10px] font-black text-slate-700 uppercase">Draft</span>
                                </div>
                            ))}
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
