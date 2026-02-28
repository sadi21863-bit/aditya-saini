import { db } from "@/db";
import { ideas, users } from "@/db/schema";
import { desc, eq, and } from "drizzle-orm";
import SparkButton from "@/components/SparkButton";
import Link from "next/link";
import { Globe, BookOpen } from "lucide-react";

export default async function ProfilePage({ params }: { params: { handle: string } }) {
  const userResult = await db.select().from(users).where(eq(users.handle, params.handle)).limit(1);
  const user = userResult[0];

  if (!user) {
    return (
      <div className="min-h-screen bg-[#f8fafb] flex items-center justify-center">
        <div className="text-center">
          <p className="text-2xl font-bold text-slate-400" style={{ fontFamily: 'var(--font-playfair)' }}>User not found</p>
          <p className="text-slate-500 mt-2">No profile for @{params.handle}</p>
          <Link href="/feed" className="mt-6 inline-block text-[#0d9488] font-semibold hover:underline">← Back to Feed</Link>
        </div>
      </div>
    );
  }

  const publicIdeas = await db.select().from(ideas)
    .where(and(eq(ideas.userId, user.id), eq(ideas.status, "public")))
    .orderBy(desc(ideas.createdAt));

  const draftIdeas = await db.select().from(ideas)
    .where(and(eq(ideas.userId, user.id), eq(ideas.status, "draft")))
    .orderBy(desc(ideas.createdAt));

  const totalLikes = publicIdeas.reduce((sum, i) => sum + (i.totalLikes ?? 0), 0);
  const viewerId = "user_test_123";

  return (
    <div className="min-h-screen bg-[#f8fafb] p-8">
      <div className="max-w-5xl mx-auto">

        {/* PROFILE CARD */}
        <div className="bg-white border border-slate-100 rounded-3xl p-8 mb-10 shadow-sm">
          <div className="flex flex-col md:flex-row items-center gap-8">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#0d9488] to-teal-300 flex items-center justify-center text-3xl font-bold text-white border-4 border-white shadow-lg">
              {(user.name ?? user.id)[0].toUpperCase()}
            </div>
            <div className="text-center md:text-left flex-1">
              <h1 className="text-3xl font-bold text-slate-900" style={{ fontFamily: 'var(--font-playfair)' }}>
                {user.handle ? `@${user.handle}` : user.name ?? user.id}
              </h1>
              <div className="flex flex-wrap gap-3 mt-3 justify-center md:justify-start">
                <span className="text-xs font-semibold px-3 py-1 rounded-full bg-[#0d9488]/10 text-[#0d9488] border border-[#0d9488]/20">
                  {user.tier ?? "Beginner"}
                </span>
                <span className="text-xs font-semibold px-3 py-1 rounded-full bg-slate-100 text-slate-600">
                  ⚡ {totalLikes} Likes
                </span>
                <span className="text-xs font-semibold px-3 py-1 rounded-full bg-slate-100 text-slate-600">
                  {publicIdeas.length} Public Ideas
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* PUBLIC IDEAS */}
          <div>
            <div className="flex items-center gap-2 mb-5">
              <Globe size={18} className="text-[#0d9488]" />
              <h2 className="text-lg font-bold text-slate-900" style={{ fontFamily: 'var(--font-playfair)' }}>Public Ideas</h2>
            </div>
            <div className="space-y-3">
              {publicIdeas.length === 0 && (
                <div className="border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center text-slate-400 italic text-sm">No public ideas yet.</div>
              )}
              {publicIdeas.map(idea => (
                <div key={idea.id} className="bg-white border border-slate-100 p-5 rounded-2xl hover:border-[#0d9488]/30 transition-all shadow-sm">
                  <h4 className="font-bold text-slate-900 mb-1" style={{ fontFamily: 'var(--font-playfair)' }}>{idea.title}</h4>
                  <p className="text-xs text-slate-500 italic mb-3">"{idea.hook}"</p>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-semibold text-[#0d9488] uppercase">{idea.category}</span>
                    <SparkButton ideaId={idea.id} viewerId={viewerId} initialLikes={idea.totalLikes ?? 0} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* DRAFTS */}
          <div>
            <div className="flex items-center gap-2 mb-5">
              <BookOpen size={18} className="text-amber-500" />
              <h2 className="text-lg font-bold text-slate-900" style={{ fontFamily: 'var(--font-playfair)' }}>Drafts</h2>
            </div>
            <div className="space-y-3">
              {draftIdeas.length === 0 && (
                <div className="border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center text-slate-400 italic text-sm">No drafts.</div>
              )}
              {draftIdeas.map(idea => (
                <div key={idea.id} className="bg-amber-50 border border-amber-100 p-5 rounded-2xl">
                  <h4 className="font-bold text-slate-700" style={{ fontFamily: 'var(--font-playfair)' }}>{idea.title}</h4>
                  <span className="text-[10px] font-semibold text-amber-600 uppercase mt-1 block">Draft</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
