import { db } from "@/db";
import { ideas } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import FeedFilter from "@/components/FeedFilter";
import IdeaCard from "@/components/IdeaCard";
import { Rss } from "lucide-react";

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const params = await searchParams;
  const selectedCategory = params.category;

  const allIdeas = await db
    .select()
    .from(ideas)
    .where(eq(ideas.status, "public"))
    .orderBy(desc(ideas.createdAt));

  const categories = Array.from(
    new Set(allIdeas.map((v) => v.category).filter(Boolean))
  ) as string[];

  const filtered = selectedCategory
    ? allIdeas.filter((v) => v.category === selectedCategory)
    : allIdeas;

  return (
    <div className="min-h-screen bg-[#f8fafb] p-8">
      <div className="max-w-6xl mx-auto">

        {/* HEADER */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-[#0d9488]/10 rounded-xl">
              <Rss className="text-[#0d9488]" size={22} />
            </div>
            <p className="text-sm font-semibold text-[#0d9488] uppercase tracking-widest">Public Feed</p>
          </div>
          <h1 className="text-5xl font-bold text-slate-900 tracking-tight" style={{ fontFamily: 'var(--font-playfair)' }}>
            The Feed
          </h1>
          <p className="text-slate-500 mt-2">Discover ideas from the community.</p>
        </div>

        {/* FILTER */}
        <FeedFilter categories={categories} />

        {/* GRID */}
        {filtered.length === 0 ? (
          <div className="py-24 text-center border-2 border-dashed border-slate-200 rounded-3xl bg-white">
            <p className="text-slate-400 text-lg font-medium" style={{ fontFamily: 'var(--font-playfair)' }}>
              No ideas in this category yet.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((idea) => (
              <IdeaCard key={idea.id} idea={idea} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
