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

  // TODO: get real viewerId from Clerk auth session
  const viewerId = "user_test_123";

  return (
    <main className="p-8 max-w-4xl mx-auto min-h-screen">
      <div className="mb-12">
        <Link
          href="/"
          className="text-slate-400 hover:text-slate-900 transition-colors font-bold text-sm flex items-center gap-2 group"
        >
          <span className="group-hover:-translate-x-1 transition-transform">←</span> RETURN TO THE AETHER
        </Link>
      </div>

      <article className="bg-white border border-slate-100 rounded-[3rem] p-12 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-teal-50 rounded-full blur-[100px] -z-10 opacity-50" />

        <header className="mb-10">
          <div className="flex items-center gap-4 mb-6">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] bg-blue-600 text-white px-5 py-2 rounded-full">
              {idea.category ?? "General"} Category
            </span>
            <span className="text-slate-300 font-bold text-xs uppercase tracking-widest">
              Captured {idea.createdAt ? new Date(idea.createdAt).toLocaleDateString() : 'Recently'}
            </span>
          </div>

          <h1 className="text-5xl font-black text-slate-900 leading-[1.1] tracking-tight mb-8">
            {idea.title}
          </h1>

          <div className="flex items-center gap-8">
            <SparkButton
              ideaId={idea.id}
              viewerId={viewerId}
              initialLikes={idea.totalLikes ?? 0}
            />
          </div>
        </header>

        <div className="prose prose-slate lg:prose-xl max-w-none">
          <p className="text-slate-600 leading-relaxed text-xl font-medium whitespace-pre-wrap">
            {idea.content}
          </p>
        </div>

        <footer className="mt-16 pt-8 border-t border-slate-50 flex justify-between items-center text-slate-400 italic font-medium">
          <p>"This spark is now part of the permanent Aether record."</p>
          <div className="flex gap-2">
            <div className="w-2 h-2 rounded-full bg-teal-400 animate-ping" />
            <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
          </div>
        </footer>
      </article>

      <div className="mt-8 flex justify-end gap-4">
        <Link
          href={`/idea/${idea.id}/edit`}
          className="text-xs font-black text-slate-300 hover:text-slate-600 uppercase tracking-widest transition-colors"
        >
          Edit Idea
        </Link>
      </div>
    </main>
  );
}
