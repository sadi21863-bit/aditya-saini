import { db } from "@/db";
import { ideas } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import HangarCard from "../../components/HangarCard";
import SystemLog from "@/components/SystemLog";
import { Activity } from "lucide-react";

export default async function HangarPage() {
    // TODO: replace with real Clerk user ID once auth is added
    const userId = "user_test_123";

    const result = await db.select()
        .from(ideas)
        .where(and(eq(ideas.userId, userId), eq(ideas.status, "draft")))
        .orderBy(desc(ideas.updatedAt));

    // Sanitize data — guard against nulls reaching client components
    const drafts = (result ?? []).map((item) => ({
        ...item,
        title: item.title ?? "Untitled",
        hook: item.hook ?? "",
        content: item.content ?? "",
        category: item.category ?? "General",
        totalLikes: item.totalLikes ?? 0,
        createdAt: item.createdAt ? item.createdAt.toISOString() : new Date().toISOString(),
        updatedAt: item.updatedAt ? item.updatedAt.toISOString() : new Date().toISOString(),
    }));

    return (
        <div className="p-8 bg-black min-h-screen text-slate-300 font-sans">
            <div className="flex items-center gap-4 mb-12 border-b border-slate-900 pb-8">
                <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                    <Activity className="text-blue-500" size={24} />
                </div>
                <div>
                    <h1 className="text-3xl font-bold tracking-tighter uppercase italic text-white">Hangar_Control</h1>
                    <p className="text-slate-500 text-[10px] font-mono tracking-[0.3em]">
                        Protocol: {drafts.length > 0 ? "Active_Sync" : "Idle"} // Visions: {drafts.length}
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-12 gap-8">
                <div className="col-span-12 lg:col-span-8 space-y-6">
                    {drafts.length === 0 ? (
                        <div className="h-48 border border-dashed border-slate-800 rounded-3xl flex items-center justify-center bg-slate-900/20">
                            <p className="text-slate-600 font-mono text-[10px] uppercase tracking-widest">Sector Empty // No Drafts Detected</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {drafts.map((draft) => (
                                <HangarCard key={draft.id} draft={draft} />
                            ))}
                        </div>
                    )}
                </div>
                <div className="col-span-12 lg:col-span-4">
                    <SystemLog drafts={drafts} />
                </div>
            </div>
        </div>
    );
}
