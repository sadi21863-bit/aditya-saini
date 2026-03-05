// app/registry/page.tsx
import { db } from "@/db";
import { ideas, users } from "@/db/schema";
import { eq, desc, ilike, or, and } from "drizzle-orm";
import { Search, Filter } from "lucide-react";
import Link from "next/link";
import { getTier } from "@/lib/tier-engine";
import RegistrySearchTabs from "@/components/RegistrySearchTabs";

type SortOption = "recent" | "xp";
type SearchType = "all" | "ideas" | "creators" | "category";

export default async function RegistryPage({
    searchParams,
}: {
    searchParams: Promise<{
        q?: string;
        category?: string;
        sort?: string;
        type?: string;
    }>;
}) {
    const resolvedParams = await searchParams;
    const query = resolvedParams.q || "";
    const category = resolvedParams.category || "";
    const sort = (resolvedParams.sort || "recent") as SortOption;
    const searchType = (resolvedParams.type || "all") as SearchType;

    // Build search conditions
    const conditions = [eq(ideas.status, "public")];

    // Category filter
    if (category && category !== "all") {
        conditions.push(eq(ideas.category, category));
    }

    // Text search based on type
    if (query) {
        const searchConditions = [];

        if (searchType === "all" || searchType === "ideas") {
            searchConditions.push(
                ilike(ideas.title, `%${query}%`),
                ilike(ideas.hook, `%${query}%`)
            );
        }

        if (searchType === "all" || searchType === "creators") {
            searchConditions.push(
                ilike(users.name, `%${query}%`),
                ilike(users.handle, `%${query}%`)
            );
        }

        if (searchType === "category") {
            searchConditions.push(ilike(ideas.category, `%${query}%`));
        }

        if (searchConditions.length > 0) {
            conditions.push(or(...searchConditions));
        }
    }

    // Fetch ideas with creator info
    const publicIdeas = await db
        .select({
            id: ideas.id,
            title: ideas.title,
            hook: ideas.hook,
            category: ideas.category,
            totalLikes: ideas.totalLikes,
            views: ideas.views,
            partnerIds: ideas.partnerIds,
            createdAt: ideas.createdAt,
            creator: {
                id: users.id,
                name: users.name,
                handle: users.handle,
                xp: users.xp,
            },
        })
        .from(ideas)
        .leftJoin(users, eq(ideas.userId, users.id))
        .where(and(...conditions))
        .orderBy(sort === "xp" ? desc(users.xp) : desc(ideas.createdAt))
        .limit(50);

    // Get unique categories
    const categories = await db
        .selectDistinct({ category: ideas.category })
        .from(ideas)
        .where(eq(ideas.status, "public"));

    const uniqueCategories = categories
        .map((c) => c.category)
        .filter(Boolean) as string[];

    const totalResults = publicIdeas.length;
    const uniqueCreators = new Set(publicIdeas.map(i => i.creator?.id).filter(Boolean)).size;

    return (
        <div className="min-h-screen bg-[#f8fafb] p-8">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <header className="mb-10">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 bg-[#0d9488]/10 rounded-xl">
                            <Search className="text-[#0d9488]" size={22} />
                        </div>
                        <p className="text-sm font-semibold text-[#0d9488] uppercase tracking-widest">
                            Discovery
                        </p>
                    </div>
                    <h1
                        className="text-4xl font-bold text-slate-900 tracking-tight mb-2"
                        style={{ fontFamily: "var(--font-playfair)" }}
                    >
                        Global Registry
                    </h1>
                    <p className="text-slate-500">
                        Explore ideas, discover creators, and find inspiration
                    </p>
                </header>

                {/* Search & Filters */}
                <div className="bg-white rounded-3xl border border-slate-100 p-6 mb-8 shadow-sm">
                    <form method="GET" className="space-y-4">
                        {/* Search Bar */}
                        <div className="relative">
                            <Search
                                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                                size={20}
                            />
                            <input
                                type="text"
                                name="q"
                                defaultValue={query}
                                placeholder="Search ideas, creators, or categories..."
                                className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0d9488] focus:border-transparent"
                            />
                        </div>

                        {/* Search Type Tabs */}
                        <RegistrySearchTabs />

                        {/* Filters Row */}
                        <div className="flex flex-wrap gap-3">
                            {/* Category Filter */}
                            <div className="flex items-center gap-2">
                                <Filter size={16} className="text-slate-400" />
                                <select
                                    name="category"
                                    defaultValue={category}
                                    className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0d9488]"
                                >
                                    <option value="">All Categories</option>
                                    {uniqueCategories.map((cat) => (
                                        <option key={cat} value={cat}>
                                            {cat}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Sort */}
                            <select
                                name="sort"
                                defaultValue={sort}
                                className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0d9488]"
                            >
                                <option value="recent">📅 Most Recent</option>
                                <option value="xp">🏆 Highest XP</option>
                            </select>

                            {/* Search Button */}
                            <button
                                type="submit"
                                className="px-6 py-2 bg-[#0d9488] text-white rounded-lg font-semibold hover:bg-[#0f766e] transition-colors"
                            >
                                Search
                            </button>

                            {/* Clear Filters */}
                            {(query || category || searchType !== "all") && (
                                <Link
                                    href="/registry"
                                    className="px-4 py-2 text-slate-600 hover:text-slate-900 font-medium transition-colors inline-flex items-center"
                                >
                                    Clear
                                </Link>
                            )}
                        </div>
                    </form>
                </div>

                {/* Search Results Summary */}
                {query && (
                    <div className="mb-6 p-4 bg-teal-50 border border-teal-200 rounded-2xl">
                        <p className="text-sm text-teal-800">
                            <span className="font-bold">{totalResults}</span> ideas found
                            {searchType === "all" && uniqueCreators > 0 && (
                                <>
                                    {" "}from <span className="font-bold">{uniqueCreators}</span> creators
                                </>
                            )}
                            {query && (
                                <>
                                    {" "}matching "<span className="font-semibold">{query}</span>"
                                </>
                            )}
                        </p>
                    </div>
                )}

                {/* Results */}
                {publicIdeas.length === 0 ? (
                    <div className="text-center py-16 bg-white rounded-3xl border border-slate-100">
                        <Search size={48} className="mx-auto text-slate-300 mb-4" />
                        <h3 className="text-xl font-bold text-slate-900 mb-2">
                            No results found
                        </h3>
                        <p className="text-slate-500">
                            Try adjusting your search or filters
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="mb-6 flex items-center justify-between">
                            <p className="text-sm text-slate-600 font-medium">
                                Showing{" "}
                                <span className="font-bold text-[#0d9488]">
                                    {publicIdeas.length}
                                </span>{" "}
                                results
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {publicIdeas.map((item) => {
                                const tier = getTier(item.creator?.xp ?? 0);
                                const partnerCount = item.partnerIds?.length || 0;

                                return (
                                    <div
                                        key={item.id}
                                        className="bg-white rounded-3xl border border-slate-100 p-6 hover:border-[#0d9488] hover:shadow-lg transition-all"
                                    >
                                        {/* Category Badge */}
                                        {item.category && (
                                            <span className="inline-block px-3 py-1 bg-violet-50 text-violet-700 text-xs font-bold rounded-full mb-3 border border-violet-200">
                                                {item.category}
                                            </span>
                                        )}

                                        {/* Title - Clickable to idea */}
                                        <Link href={`/idea/${item.id}`}>
                                            <h3 className="text-xl font-bold text-slate-900 mb-2 hover:text-[#0d9488] transition-colors line-clamp-2 cursor-pointer">
                                                {item.title}
                                            </h3>
                                        </Link>

                                        {/* Hook */}
                                        {item.hook && (
                                            <p className="text-slate-600 text-sm mb-4 line-clamp-2">
                                                {item.hook}
                                            </p>
                                        )}

                                        {/* Stats */}
                                        <div className="flex items-center gap-4 text-xs text-slate-500 mb-4">
                                            <span>❤️ {item.totalLikes}</span>
                                            <span>👁️ {item.views}</span>
                                            {partnerCount > 0 && (
                                                <span className="text-[#0d9488] font-semibold">
                                                    🤝 {partnerCount}
                                                </span>
                                            )}
                                        </div>

                                        {/* Creator - Separate clickable area */}
                                        <div className="pt-4 border-t border-slate-100">
                                            <Link
                                                href={`/profile/${item.creator?.handle || item.creator?.id}`}
                                                className="flex items-center gap-3 hover:bg-slate-50 -mx-6 -mb-6 px-6 pb-6 rounded-b-3xl transition-colors"
                                            >
                                                <div
                                                    className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${tier.bgColor} ${tier.color} border-2 ${tier.borderColor}`}
                                                >
                                                    {item.creator?.name?.[0]?.toUpperCase() || "?"}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-semibold text-slate-900 text-sm truncate">
                                                        {item.creator?.name || "Anonymous"}
                                                    </p>
                                                    <p className="text-xs text-slate-500 truncate">
                                                        @{item.creator?.handle || "unknown"}
                                                    </p>
                                                </div>
                                                <div
                                                    className={`px-2 py-1 rounded-lg text-xs font-bold ${tier.bgColor} ${tier.color}`}
                                                >
                                                    {item.creator?.xp || 0} XP
                                                </div>
                                            </Link>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
