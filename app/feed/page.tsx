import { db } from "@/db";
import { ideas, users } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import IdeaCard from "@/components/IdeaCard";
import { Suspense } from "react";
import { Lightbulb } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Feed Content Component
// ─────────────────────────────────────────────────────────────────────────────
async function FeedContent() {
  // Fetch all public ideas with author info
  const publicIdeas = await db
    .select({
      // Idea fields
      id: ideas.id,
      userId: ideas.userId,
      title: ideas.title,
      hook: ideas.hook,
      content: ideas.content,
      category: ideas.category,
      status: ideas.status,
      totalLikes: ideas.totalLikes,
      views: ideas.views,
      blurLevel: ideas.blurLevel,
      genesisHash: ideas.genesisHash,
      simHash: ideas.simHash,
      viewerIds: ideas.viewerIds,
      partnerIds: ideas.partnerIds,
      aiMetadata: ideas.aiMetadata,
      createdAt: ideas.createdAt,
      updatedAt: ideas.updatedAt,
      // Author fields
      author: {
        id: users.id,
        name: users.name,
        handle: users.handle,
        image: users.image,
        tier: users.tier,
      },
    })
    .from(ideas)
    .leftJoin(users, eq(ideas.userId, users.id))
    .where(eq(ideas.status, "public"))
    .orderBy(desc(ideas.createdAt));

  if (publicIdeas.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="p-4 bg-slate-100 rounded-full mb-4">
          <Lightbulb className="text-slate-400" size={40} />
        </div>
        <h2 className="text-xl font-bold text-slate-700 mb-2">No Ideas Yet</h2>
        <p className="text-slate-500 text-sm max-w-md">
          Be the first to launch an idea to the Genesis Registry!
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {publicIdeas.map((item) => (
        <IdeaCard
          key={item.id}
          idea={{
            id: item.id,
            userId: item.userId,
            title: item.title,
            hook: item.hook,
            content: item.content,
            category: item.category,
            status: item.status,
            totalLikes: item.totalLikes,
            views: item.views,
            blurLevel: item.blurLevel,
            genesisHash: item.genesisHash,
            simHash: item.simHash,
            viewerIds: item.viewerIds || [],
            partnerIds: item.partnerIds || [],
            aiMetadata: item.aiMetadata,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt,
          }}
          author={item.author}
          viewerId="user_test_123"
        />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Loading Skeleton
// ─────────────────────────────────────────────────────────────────────────────
function FeedSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="bg-white border border-slate-100 rounded-3xl p-6 animate-pulse"
        >
          <div className="space-y-4">
            <div className="h-4 bg-slate-100 rounded w-1/3" />
            <div className="h-6 bg-slate-100 rounded w-2/3" />
            <div className="h-4 bg-slate-100 rounded w-full" />
            <div className="h-4 bg-slate-100 rounded w-full" />
            <div className="flex gap-2">
              <div className="h-6 bg-slate-100 rounded w-16" />
              <div className="h-6 bg-slate-100 rounded w-16" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Feed Page
// ─────────────────────────────────────────────────────────────────────────────
export default function FeedPage() {
  return (
    <div className="min-h-screen bg-[#f8fafb] p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-[#0d9488]/10 rounded-xl">
              <Lightbulb className="text-[#0d9488]" size={22} />
            </div>
            <p className="text-sm font-semibold text-[#0d9488] uppercase tracking-widest">
              Genesis Registry
            </p>
          </div>
          <h1
            className="text-4xl md:text-5xl font-bold text-slate-900 tracking-tight"
            style={{ fontFamily: "var(--font-playfair)" }}
          >
            Live Ideas
          </h1>
          <p className="text-slate-500 mt-2">
            Explore verified ideas from the community
          </p>
        </div>

        {/* Feed Grid */}
        <Suspense fallback={<FeedSkeleton />}>
          <FeedContent />
        </Suspense>
      </div>
    </div>
  );
}
