import { db } from "@/db";
import { ideas } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";

export default async function ManageIdeaPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    const result = await db.select().from(ideas).where(eq(ideas.id, id));
    const idea = result[0];

    if (!idea) notFound();

    async function updateNova(formData: FormData) {
        "use server";
        const status = formData.get("status") as "draft" | "public" | "archived";

        await db.update(ideas)
            .set({ status })
            .where(eq(ideas.id, id));

        redirect("/vault");
    }

    return (
        <main className="p-8 lg:p-12 max-w-3xl mx-auto">
            <header className="mb-10">
                <Link href="/vault" className="text-slate-400 hover:text-slate-900 font-bold text-xs mb-4 flex items-center gap-2">
                    ← BACK TO VAULT
                </Link>
                <h1 className="text-4xl font-black tracking-tighter italic uppercase text-slate-900">
                    Configure Idea
                </h1>
                <p className="text-slate-500 font-medium italic mt-2">"{idea.title}"</p>
            </header>

            <form action={updateNova} className="space-y-10">
                <section className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-6">
                        Visibility Status
                    </label>
                    <div className="grid grid-cols-3 gap-4">
                        {['draft', 'public', 'archived'].map((s) => (
                            <label key={s} className="cursor-pointer group">
                                <input
                                    type="radio"
                                    name="status"
                                    value={s}
                                    defaultChecked={idea.status === s}
                                    className="peer hidden"
                                />
                                <div className="text-center p-4 rounded-2xl border-2 border-slate-50 font-bold text-xs uppercase transition-all peer-checked:border-teal-500 peer-checked:bg-teal-50 peer-checked:text-teal-700 group-hover:border-slate-200">
                                    {s}
                                </div>
                            </label>
                        ))}
                    </div>
                </section>

                <div className="flex gap-4">
                    <button
                        type="submit"
                        className="flex-1 bg-slate-900 text-white p-6 rounded-[2rem] font-black text-xl hover:bg-teal-600 transition-all active:scale-[0.98] shadow-xl shadow-slate-200"
                    >
                        ✦ COMMIT CHANGES
                    </button>
                    <Link
                        href="/vault"
                        className="flex items-center justify-center px-8 bg-white border border-slate-200 text-slate-400 rounded-[2rem] font-bold hover:text-slate-900"
                    >
                        CANCEL
                    </Link>
                </div>
            </form>
        </main>
    );
}
