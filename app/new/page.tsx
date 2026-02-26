import { db } from "@/db";
import { ideas } from "@/db/schema";
import IdeaForm from "@/components/IdeaForm";
import { Sparkles } from "lucide-react";

export default async function NewIdeaPage() {
  const result = await db.select({ category: ideas.category }).from(ideas);
  const existingCategories = Array.from(
    new Set(result.map(r => r.category).filter(Boolean))
  ) as string[];

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center py-20 px-4">
      <div className="text-center mb-10 space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-black tracking-widest uppercase">
          <Sparkles size={12} />
          New Idea Portal
        </div>
        <h1 className="text-5xl font-black text-white italic tracking-tighter">NEW_IDEA</h1>
        <p className="text-slate-500 font-mono text-xs tracking-widest uppercase">
          Converting thought into digital matter
        </p>
      </div>

      <div className="w-full max-w-2xl">
        <IdeaForm existingCategories={existingCategories} />
      </div>

      <p className="mt-8 text-slate-700 font-mono text-[9px] uppercase tracking-widest">
        System Status: Ready // Connection Stable
      </p>
    </div>
  );
}
