import { db } from "@/db";
import { ideas } from "@/db/schema";
import { eq } from "drizzle-orm";
import { updateIdea, deleteIdea } from "@/app/actions/ideaActions";
import { CATEGORIES } from "@/lib/categories";
import { notFound } from "next/navigation";
import Link from "next/link";

export default async function EditIdea({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [idea] = await db.select().from(ideas).where(eq(ideas.id, id));
  if (!idea) notFound();

  const updateIdeaWithId = updateIdea.bind(null, id);
  const deleteIdeaWithId = deleteIdea.bind(null, id);

  return (
    <main className="min-h-screen bg-[#f8fafb] p-8">
      <div className="max-w-2xl mx-auto">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-slate-400 hover:text-[#0d9488] font-semibold text-sm mb-8 transition-colors group"
        >
          <span className="group-hover:-translate-x-1 transition-transform">←</span>
          Back to Dashboard
        </Link>

        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8">
          <h1
            className="text-3xl font-bold text-slate-900 mb-8"
            style={{ fontFamily: "var(--font-playfair)" }}
          >
            Edit Idea
          </h1>

          <form action={updateIdeaWithId} className="flex flex-col gap-5">
            {/* Title */}
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest block mb-2">
                Title
              </label>
              <input
                name="title"
                defaultValue={idea.title}
                className="w-full bg-slate-50 p-4 rounded-2xl border border-slate-200 focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/20 outline-none"
                required
              />
            </div>

            {/* Category — mapped from lib/categories.ts */}
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest block mb-2">
                Category
              </label>
              <select
                name="category"
                defaultValue={idea.category ?? CATEGORIES[0]}
                className="w-full bg-slate-50 p-4 rounded-2xl border border-slate-200 focus:border-[#0d9488] outline-none"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Hook */}
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest block mb-2">
                Hook
              </label>
              <input
                name="hook"
                defaultValue={idea.hook ?? ""}
                placeholder="One-sentence essence..."
                className="w-full bg-slate-50 p-4 rounded-2xl border border-slate-200 italic focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/20 outline-none"
              />
            </div>

            {/* Content */}
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest block mb-2">
                Content
              </label>
              <textarea
                name="content"
                defaultValue={idea.content ?? ""}
                className="w-full bg-slate-50 p-4 rounded-2xl border border-slate-200 h-40 focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/20 outline-none resize-none"
                required
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                className="flex-1 bg-[#0d9488] text-white py-4 rounded-2xl font-bold hover:bg-teal-700 transition-all shadow-md active:scale-95"
              >
                Save Changes
              </button>
              <Link
                href={`/idea/${id}`}
                className="px-6 py-4 text-slate-400 font-medium hover:text-slate-600 transition-colors"
              >
                Cancel
              </Link>
            </div>
          </form>

          {/* Delete */}
          <form action={deleteIdeaWithId} className="mt-6 pt-6 border-t border-slate-100">
            <button
              type="submit"
              className="w-full text-red-400 text-sm font-semibold hover:text-red-600 transition-colors py-2"
            >
              Delete this Idea
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
