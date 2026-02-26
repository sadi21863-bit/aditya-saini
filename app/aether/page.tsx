import { db } from "@/db";
import { ideas } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import AetherFilter from "@/components/AetherFilter";
import IdeaCard from "@/components/IdeaCard";

export default async function AetherPage({
    searchParams,
}: {
    searchParams: Promise<{ category?: string }>;
}) {
    const params = await searchParams;
    const selectedCategory = params.category;

    const allVisions = await db.select()
        .from(ideas)
        .where(eq(ideas.status, "public"))
        .orderBy(desc(ideas.createdAt));

    // Derive unique categories for the filter bar
    const uniqueCategories = Array.from(new Set(allVisions.map(v => v.category).filter(Boolean))) as string[];

    const filteredVisions = selectedCategory
        ? allVisions.filter(v => v.category === selectedCategory)
        : allVisions;

    return (
        <div className="p-8 bg-black min-h-screen text-white">
            <div className="mb-10">
                <h1 className="text-6xl font-black tracking-tighter italic text-blue-500">AETHER_FEED</h1>
                <p className="text-slate-500 font-mono text-[9px] tracking-[0.4em] uppercase">Streaming Global Intelligence</p>
            </div>

            <AetherFilter spheres={uniqueCategories} />

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {filteredVisions.map((vision) => (
                    <IdeaCard key={vision.id} idea={vision} />
                ))}
            </div>

            {filteredVisions.length === 0 && (
                <div className="h-64 flex items-center justify-center border border-slate-900 rounded-[40px] opacity-30">
                    <p className="font-black uppercase tracking-widest text-xs">Dimension Empty</p>
                </div>
            )}
        </div>
    );
}
