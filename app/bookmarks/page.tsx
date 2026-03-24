import { requireAuth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { bookmarks, ideas, users } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import IdeaCard from "@/components/IdeaCard";
import Link from "next/link";
import { Bookmark } from "lucide-react";

export default async function BookmarksPage() {
    let userId = "";
    try {
        userId = await requireAuth();
    } catch {
        redirect("/sign-in");
    }

    if (!userId) redirect("/sign-in");

    const rows = await db
        .select({
            bookmark: bookmarks,
            idea: ideas,
            author: {
                handle: users.handle,
                name: users.name,
                tier: users.tier,
                xp: users.xp,
            },
        })
        .from(bookmarks)
        .innerJoin(ideas, eq(bookmarks.ideaId, ideas.id))
        .leftJoin(users, eq(ideas.userId, users.id))
        .where(
            and(
                eq(bookmarks.userId, userId),
                // FIX #14: Exclude soft-deleted ideas so '[deleted]' entries don't show
                eq(ideas.status, "public")
            )
        )
        // FIX #20: Descending sort — newest bookmarks first
        .orderBy(desc(bookmarks.createdAt));

    return (
        <div className="max-w-3xl mx-auto px-6 py-10">

            {/* Header */}
            <div className="flex items-center gap-3 mb-2">
                <Bookmark size={24} className="text-[#0d9488]" />
                <h1 className="text-3xl font-bold text-white">Saved Ideas</h1>
            </div>
            <p className="text-slate-400 text-sm mb-8">
                Your private collection — only visible to you.
            </p>

            {rows.length === 0 ? (
                <div className="text-center py-20">
                    <Bookmark size={40} className="mx-auto text-slate-700 mb-4" />
                    <p className="text-slate-400 text-sm mb-4">No saved ideas yet.</p>
                    <Link
                        href="/feed"
                        className="inline-block px-5 py-2.5 rounded-xl bg-[#0d9488]
              text-white text-sm font-bold hover:bg-teal-500 transition-colors"
                    >
                        Browse Ideas →
                    </Link>
                </div>
            ) : (
                <div className="flex flex-col gap-4">
                    {rows.map(({ idea, author }) => (
                        <IdeaCard
                            key={idea.id}
                            idea={idea}
                            author={author}
                            viewerId={userId}
                            hasLiked={false}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
