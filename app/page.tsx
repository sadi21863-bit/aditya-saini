import { db } from "@/db";
import { ideas } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import IdeaCard from "@/components/IdeaCard";

export default async function HomePage() {
  const allIdeas = await db.select()
    .from(ideas)
    .where(eq(ideas.status, "public"))
    .orderBy(desc(ideas.createdAt));

  return (
    <main className="min-h-screen bg-black text-slate-200 p-8">
      <div className="max-w-7xl mx-auto">
        <header className="mb-12 border-b border-slate-900 pb-6">
          <h1 className="text-4xl font-black italic tracking-tighter uppercase">The_Aether</h1>
          <p className="text-slate-600 font-mono text-xs uppercase tracking-[0.3em]">Public_Feed // Link_Established</p>
        </header>

        {allIdeas.length === 0 ? (
          <div className="py-20 text-center border border-dashed border-slate-900 rounded-[40px]">
            <p className="text-slate-700 font-mono text-xs uppercase">Aether_Vacuum: No signals found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {allIdeas.map((idea) => (
              <IdeaCard key={idea.id} idea={idea} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
