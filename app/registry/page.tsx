// app/registry/page.tsx
import { db } from "@/db";
import { ideas, users } from "@/db/schema";
import { eq, desc, ilike, or, and, SQL } from "drizzle-orm";
import { Search, Filter } from "lucide-react";
import Link from "next/link";
import { getTierFromXp } from "@/lib/tier-engine";
import RegistrySearchTabs from "@/components/RegistrySearchTabs";
import { Suspense } from "react";

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
    const query = resolvedParams.q?.trim() || "";
    const category = resolvedParams.category || "";
    const sort = (resolvedParams.sort || "recent") as SortOption;
    const searchType = (resolvedParams.type || "all") as SearchType;

    // FIX #30: When searching creators, query the users table directly
    // Previously joined through ideas — users with 0 published ideas were invisible
    let publicIdeas: Awaited<ReturnType<typeof getIdeasResults>> = [];
    let creatorResults: { id: string; name: string | null; handle: string | null; xp: number | null; tier: string | null }[] = [];
    let isCreatorSearch = false;

    if (searchType === "creators" && query) {
        isCreatorSearch = true;
        creatorResults = await db
            .select({ id: users.id, name: users.name, handle: users.handle, xp: users.xp, tier: users.tier })
            .from(users)
            .where(or(ilike(users.name, `%${query}%`), ilike(users.handle, `%${query}%`)))
            .limit(50);
    } else {
        publicIdeas = await getIdeasResults({ query, category, sort, searchType });
    }

    const categories = await db
        .selectDistinct({ category: ideas.category })
        .from(ideas)
        .where(eq(ideas.status, "public"));

    const uniqueCategories = categories.map((c) => c.category).filter(Boolean) as string[];
    const totalResults = isCreatorSearch ? creatorResults.length : publicIdeas.length;

    return (
        <div className="min-h-screen bg-slate-950 p-8">
            <div className="max-w-6xl mx-auto">
                <header className="mb-10">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 bg-teal-500/10 rounded-xl">
                            <Search className="text-teal-400" size={22} />
                        </div>
                        <p className="text-sm font-semibold text-teal-400 uppercase tracking-widest">
                            Discovery
                        </p>
                    </div>
                    <h1 className="text-4xl font-bold text-white tracking-tight mb-2">
                        Global Registry
                    </h1>
                    <p className="text-slate-400">
                        Explore ideas, discover creators, and find inspiration
                    </p>
                </header>

                {/* Search & Filters */}
                <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 mb-8">
                    <form method="GET" className="space-y-4">
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                            <input
                                type="text"
                                name="q"
                                defaultValue={query}
                                placeholder="Search ideas, creators, or categories..."
                                className="w-full pl-12 pr-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
                            />
                        </div>

                        {/* FIX #24: Suspense boundary — RegistrySearchTabs uses useSearchParams */}
                        <Suspense fallback={<div className="h-10" />}>
                            <RegistrySearchTabs />
                        </Suspense>

                        <div className="flex flex-wrap gap-3">
                            <div className="flex items-center gap-2">
                                <Filter size={16} className="text-slate-400" />
                                <select
                                    name="category"
                                    defaultValue={category}
                                    className="px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                                >
                                    <option value="">All Categories</option>
                                    {uniqueCategories.map((cat) => (
                                        <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                </select>
                            </div>

                            <select
                                name="sort"
                                defaultValue={sort}
                                className="px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                            >
                                <option value="recent">📅 Most Recent</option>
                                <option value="xp">🏆 Highest XP</option>
                            </select>

                            <button
                                type="submit"
                                className="px-6 py-2 bg-teal-600 text-white rounded-lg font-semibold hover:bg-teal-500 transition"
                            >
                                Search
                            </button>

                            {(query || category || searchType !== "all") && (
                                <Link
                                    href="/registry"
                                    className="px-4 py-2 text-slate-400 hover:text-white font-medium transition inline-flex items-center"
                                >
                                    Clear
                                </Link>
                            )}
                        </div>
                    </form>
                </div>

                {query && (
                    <div className="mb-6 p-4 bg-teal-900/30 border border-teal-800 rounded-xl">
                        <p className="text-sm text-teal-300">
                            <span className="font-bold">{totalResults}</span>{" "}
                            {isCreatorSearch ? "creators" : "ideas"} found matching &quot;
                            <span className="font-semibold">{query}</span>&quot;
                        </p>
                    </div>
                )}

                {/* Creator Results */}
                {isCreatorSearch && (
                    creatorResults.length === 0 ? (
                        <EmptyResults />
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {creatorResults.map((user) => {
                                const tier = getTierFromXp(user.xp ?? 0);
                                return (
                                    <Link
                                        key={user.id}
                                        href={`/profile/${user.handle ?? user.id}`}
                                        className="bg-slate-900 rounded-2xl border border-slate-800 p-6 hover:border-teal-600 hover:shadow-lg transition-all flex items-center gap-4"
                                    >
                                        <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg ${tier.bgColor} ${tier.color}`}>
                                            {(user.name ?? user.id)[0].toUpperCase()}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-white truncate">{user.name ?? "Anonymous"}</p>
                                            <p className="text-sm text-slate-400 truncate">@{user.handle ?? "unknown"}</p>
                                            <span className={`inline-block mt-1 text-xs font-bold px-2 py-0.5 rounded-full ${tier.bgColor} ${tier.color}`}>
                                                {tier.displayName}
                                            </span>
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>
                    )
                )}

                {/* Idea Results */}
                {!isCreatorSearch && (
                    publicIdeas.length === 0 ? (
                        <EmptyResults />
                    ) : (
                        <>
                            <div className="mb-6">
                                <p className="text-sm text-slate-400">
                                    Showing <span className="font-bold text-teal-400">{publicIdeas.length}</span> results
                                </p>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {publicIdeas.map((item) => {
                                    const tier = getTierFromXp(item.creator?.xp ?? 0);
                                    return (
                                        <div
                                            key={item.id}
                                            className="bg-slate-900 rounded-2xl border border-slate-800 p-6 hover:border-teal-600 hover:shadow-lg transition-all"
                                        >
                                            {item.category && (
                                                <span className="inline-block px-3 py-1 bg-violet-900/40 text-violet-300 text-xs font-bold rounded-full mb-3 border border-violet-800">
                                                    {item.category}
                                                </span>
                                            )}
                                            <Link href={`/idea/${item.id}`}>
                                                <h3 className="text-lg font-bold text-white mb-2 hover:text-teal-400 transition line-clamp-2 cursor-pointer">
                                                    {item.title}
                                                </h3>
                                            </Link>
                                            {item.context && (
                                                <p className="text-slate-400 text-sm mb-4 line-clamp-2">{item.context}</p>
                                            )}
                                            <div className="flex items-center gap-4 text-xs text-slate-500 mb-4">
                                                <span>❤️ {item.totalLikes}</span>
                                                <span>👁️ {item.views}</span>
                                            </div>
                                            <div className="pt-4 border-t border-slate-800">
                                                <Link
                                                    href={`/profile/${item.creator?.handle ?? item.creator?.id}`}
                                                    className="flex items-center gap-3 hover:opacity-80 transition"
                                                >
                                                    <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm ${tier.bgColor} ${tier.color}`}>
                                                        {item.creator?.name?.[0]?.toUpperCase() ?? "?"}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-semibold text-white text-sm truncate">{item.creator?.name ?? "Anonymous"}</p>
                                                        <p className="text-xs text-slate-500 truncate">@{item.creator?.handle ?? "unknown"}</p>
                                                    </div>
                                                </Link>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )
                )}
            </div>
        </div>
    );
}

async function getIdeasResults({ query, category, sort, searchType }: {
    query: string; category: string; sort: SortOption; searchType: SearchType;
}) {
    const conditions: (SQL | undefined)[] = [eq(ideas.status, "public")];

    if (category && category !== "all") {
        conditions.push(eq(ideas.category, category));
    }

    if (query) {
        if (searchType === "ideas") {
            conditions.push(or(ilike(ideas.title, `%${query}%`), ilike(ideas.content, `%${query}%`)));
        } else if (searchType === "category") {
            conditions.push(ilike(ideas.category, `%${query}%`));
        } else {
            conditions.push(or(ilike(ideas.title, `%${query}%`), ilike(users.name, `%${query}%`), ilike(users.handle, `%${query}%`)));
        }
    }

    return db
        .select({
            id: ideas.id,
            title: ideas.title,
            context: ideas.context,
            category: ideas.category,
            totalLikes: ideas.totalLikes,
            views: ideas.views,
            createdAt: ideas.createdAt,
            creator: { id: users.id, name: users.name, handle: users.handle, xp: users.xp },
        })
        .from(ideas)
        .leftJoin(users, eq(ideas.userId, users.id))
        .where(and(...conditions))
        .orderBy(sort === "xp" ? desc(users.xp) : desc(ideas.createdAt))
        .limit(50);
}

function EmptyResults() {
    return (
        <div className="text-center py-16 bg-slate-900 rounded-2xl border border-slate-800">
            <Search size={48} className="mx-auto text-slate-600 mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">No results found</h3>
            <p className="text-slate-500">Try adjusting your search or filters</p>
        </div>
    );
}
