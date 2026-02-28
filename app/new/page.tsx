import { db } from "@/db";
import { ideas } from "@/db/schema";
import IdeaForm from "@/components/IdeaForm";
import { PlusCircle } from "lucide-react";

export default async function NewIdeaPage() {
  const result = await db.select({ category: ideas.category }).from(ideas);
  const existingCategories = Array.from(
    new Set(result.map((r) => r.category).filter(Boolean))
  ) as string[];

  return (
    <div className="min-h-screen bg-[#f8fafb] flex flex-col items-center justify-center py-20 px-4">
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#0d9488]/10 border border-[#0d9488]/20 text-[#0d9488] text-xs font-bold tracking-widest uppercase mb-4">
          <PlusCircle size={13} /> Create
        </div>
        <h1 className="text-5xl font-bold text-slate-900 tracking-tight" style={{ fontFamily: 'var(--font-playfair)' }}>
          New Idea
        </h1>
        <p className="text-slate-500 mt-2 text-sm">Share your vision with the community.</p>
      </div>
      <div className="w-full max-w-2xl">
        <IdeaForm existingCategories={existingCategories} />
      </div>
    </div>
  );
}
