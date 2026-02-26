"use client";

import { addIdea } from "@/lib/actions";
import { useRef, useState } from "react";
import { Lightbulb, Globe, Save } from "lucide-react";

export default function IdeaForm({ existingCategories = [] }: { existingCategories?: string[] }) {
    const formRef = useRef<HTMLFormElement>(null);
    const [isPending, setIsPending] = useState(false);

    return (
        <form
            ref={formRef}
            action={async (formData) => {
                setIsPending(true);
                // Now sending 'category', 'hook', and 'content' to match the DB
                await addIdea(formData);
                formRef.current?.reset();
                setIsPending(false);
            }}
            className="bg-black p-8 rounded-[32px] border border-slate-800 shadow-2xl mb-12 max-w-2xl mx-auto"
        >
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-amber-500/10 rounded-lg">
                    <Lightbulb className="text-amber-500" size={20} />
                </div>
                <h3 className="text-xl font-black text-white italic tracking-tighter uppercase">New Idea</h3>
            </div>

            <div className="space-y-5">
                {/* 1. Title */}
                <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1 mb-2 block">Idea Title</label>
                    <input
                        name="title"
                        placeholder="e.g. Solar Powered Desalination"
                        className="w-full bg-slate-900/50 p-4 rounded-2xl border border-slate-800 text-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-all"
                        required
                    />
                </div>

                {/* 2. Category (Replaces Sphere) */}
                <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1 mb-2 block flex items-center gap-2">
                        <Globe size={12} /> Category
                    </label>
                    <input
                        name="category"
                        list="category-list"
                        placeholder="Select or type (e.g. Energy, Social, Tech)"
                        className="w-full bg-slate-900/50 p-4 rounded-2xl border border-slate-800 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all font-mono text-xs"
                        required
                    />
                    <datalist id="category-list">
                        {(existingCategories ?? []).map(cat => <option key={cat} value={cat} />)}
                    </datalist>
                </div>

                {/* 3. The Hook */}
                <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1 mb-2 block text-blue-400">The Hook</label>
                    <input
                        name="hook"
                        placeholder="The one-sentence essence..."
                        className="w-full bg-slate-900/50 p-4 rounded-2xl border border-slate-800 text-white focus:border-blue-500 outline-none transition-all italic text-sm"
                        required
                    />
                </div>

                {/* 4. Content (Replaces Description) */}
                <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1 mb-2 block">Full Specification</label>
                    <textarea
                        name="content"
                        placeholder="Explain how this idea works..."
                        className="w-full bg-slate-900/50 p-4 rounded-2xl border border-slate-800 text-white focus:border-slate-600 outline-none transition-all resize-none"
                        rows={4}
                        required
                    />
                </div>

                <button
                    type="submit"
                    disabled={isPending}
                    className={`w-full py-4 rounded-2xl font-black text-xs tracking-[0.3em] transition-all flex items-center justify-center gap-2 ${isPending
                        ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                        : "bg-white text-black hover:bg-amber-500 hover:scale-[1.02] active:scale-95 shadow-xl"
                        }`}
                >
                    {isPending ? (
                        "SAVING..."
                    ) : (
                        <>
                            <Save size={16} />
                            SAVE TO VAULT
                        </>
                    )}
                </button>
            </div>
        </form>
    );
}