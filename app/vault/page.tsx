import { db } from "@/db";
import { ideas } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import Link from "next/link";

export default async function VaultPage() {
    // TODO: replace with real Clerk user ID
    const userId = "user_test_123";
    const myNovas = await db.select().from(ideas).where(eq(ideas.userId, userId)).orderBy(desc(ideas.createdAt));

    return (
        <main className="p-8 max-w-6xl mx-auto min-h-screen bg-[#fafafa]">
            <div className="mb-12">
                <Link href="/" className="text-slate-400 hover:text-slate-900 font-bold text-xs mb-4 flex items-center gap-2 group">
                    <span className="group-hover:-translate-x-1 transition-transform">←</span> BACK TO THE AETHER
                </Link>
                <h1 className="text-5xl font-black tracking-tighter italic uppercase text-slate-900">The Vault</h1>
                <p className="text-slate-500 font-medium">Your personal command center for ideas.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                <div className="lg:col-span-1">
                    <Link href="/new" className="group block">
                        <div className="p-8 bg-gradient-to-br from-teal-500 to-blue-600 rounded-[2.5rem] shadow-xl hover:shadow-teal-200 transition-all hover:-translate-y-1">
                            <span className="text-4xl mb-4 block">✦</span>
                            <h2 className="text-white text-xl font-black leading-tight">New Idea</h2>
                            <p className="text-teal-100 text-xs mt-2 font-medium uppercase tracking-widest">Start fresh</p>
                        </div>
                    </Link>

                    <div className="mt-8 p-6 bg-white border border-slate-100 rounded-[2rem]">
                        <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4">Vault Stats</h3>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-bold text-slate-600">Total Ideas</span>
                                <span className="text-sm font-black text-slate-900">{myNovas.length}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-bold text-slate-600">Total Likes</span>
                                <span className="text-sm font-black text-orange-500">
                                    {myNovas.reduce((acc, n) => acc + (n.totalLikes ?? 0), 0)}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-3 space-y-4">
                    <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4 ml-2">All Ideas</h3>

                    {myNovas.length === 0 ? (
                        <div className="bg-white border-2 border-dashed border-slate-200 rounded-[2.5rem] p-20 text-center">
                            <p className="text-slate-400 font-bold italic text-lg">Your Vault is empty. No ideas yet.</p>
                        </div>
                    ) : (
                        myNovas.map((nova) => (
                            <div key={nova.id} className="bg-white border border-slate-100 p-8 rounded-[2.5rem] flex flex-col md:flex-row md:items-center justify-between gap-6 hover:border-teal-100 transition-all shadow-sm">
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-3">
                                        <span className={`text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest ${
                                            nova.status === 'public' ? 'bg-green-100 text-green-600 border border-green-200' :
                                            nova.status === 'draft' ? 'bg-amber-100 text-amber-600 border border-amber-200' :
                                            'bg-purple-100 text-purple-600 border border-purple-200'
                                        }`}>
                                            {nova.status}
                                        </span>
                                        <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">
                                            {nova.category ?? "General"}
                                        </span>
                                    </div>
                                    <h2 className="text-2xl font-black text-slate-900 leading-tight">{nova.title}</h2>
                                </div>

                                <div className="flex items-center gap-3">
                                    <Link href={`/idea/${nova.id}`} className="p-4 bg-slate-50 text-slate-400 rounded-2xl hover:text-slate-900 transition-all font-bold text-xs">
                                        VIEW
                                    </Link>
                                    <Link href={`/idea/${nova.id}/manage`} className="p-4 bg-teal-50 text-teal-600 rounded-2xl hover:bg-teal-600 hover:text-white transition-all font-black text-xs uppercase tracking-widest">
                                        Configure
                                    </Link>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </main>
    );
}
