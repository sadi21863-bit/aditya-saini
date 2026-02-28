import { db } from "@/db";
import { ideas } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import SparkButton from "@/components/SparkButton";

export default async function IdeaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await db.select().from(ideas).where(eq(ideas.id, id));
  const idea = result[0];
  if (!idea) notFound();

  const viewerId = "user_test_123"; // TODO: Clerk session

  return (
    <main className="min-h-screen bg-[#f8fafb] p-8">
      <div className="max-w-3xl mx-auto">
        <Link
          href="/feed"
          className="inline-flex items-center gap-2 text-slate-400 hover:text-[#0d9488] transition-colors font-semibold text-sm mb-10 group"
        >
          <span className="group-hover:-translate-x-1 transition-transform">←</span> Back to Feed
        </Link>

        <article className="bg-white border border-slate-100 rounded-3xl p-10 shadow-sm">
          {/* Category + Date */}
          <div className="flex items-center gap-4 mb-6">
            <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-[#0d9488]/10 text-[#0d9488] border border-[#0d9488]/20 uppercase tracking-wider">
              {idea.category ?? "General"}
            </span>
            <span className="text-xs text-slate-400 font-medium">
              {idea.createdAt ? new Date(idea.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : ""}
            </span>
          </div>

          {/* Title */}
          <h1 className="text-4xl font-bold text-slate-900 leading-tight mb-4 tracking-tight" style={{ fontFamily: 'var(--font-playfair)' }}>
            {idea.title}
          </h1>

          {/* Hook */}
          {idea.hook && (
            <p className="text-lg text-[#0d9488] italic font-medium mb-8 pb-8 border-b border-slate-100">
              "{idea.hook}"
            </p>
          )}

          {/* Content */}
          <div className="prose prose-slate max-w-none">
            <p className="text-slate-700 leading-relaxed text-base whitespace-pre-wrap">
              {idea.content}
            </p>
          </div>

          {/* Footer actions */}
          <div className="mt-10 pt-8 border-t border-slate-100 flex items-center justify-between">
            <SparkButton
              ideaId={idea.id}
              viewerId={viewerId}
              initialLikes={idea.totalLikes ?? 0}
            />
            <Link
              href={`/idea/${idea.id}/edit`}
              className="text-xs font-semibold text-slate-400 hover:text-slate-700 uppercase tracking-widest transition-colors"
            >
              Edit Idea
            </Link>
          </div>
        </article>
      </div>
    </main>
  );
}
