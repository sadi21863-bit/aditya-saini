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
  const resolvedParams = await params;
  const id = resolvedParams.id;

  const [idea] = await db.select().from(ideas).where(eq(ideas.id, id));
  if (!idea) notFound();

  async function handleUpdate(formData: FormData): Promise<void> {
    "use server";
    await updateIdea(id, formData);
  }

  async function handleDelete(): Promise<void> {
    "use server";
    await deleteIdea(id);
  }

  return (
    <main className="min-h-screen bg-slate-950 p-8">
      <div className="max-w-2xl mx-auto">
        <Link
          href={idea.roomId ? `/rooms/${idea.roomId}` : "/dashboard"}
          className="inline-flex items-center gap-2 text-slate-400 hover:text-[#0d9488]
            font-semibold text-sm mb-8 transition-colors group"
        >
          <span className="group-hover:-translate-x-1 transition-transform">←</span>
          Back
        </Link>

        <div className="bg-slate-900 rounded-3xl border border-slate-800 p-8">
          <h1 className="text-3xl font-bold text-white mb-8">Edit Idea</h1>

          <form action={handleUpdate} className="flex flex-col gap-6">
            {/* Title */}
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest block mb-2">
                Title
              </label>
              <input
                name="title"
                defaultValue={idea.title}
                className="w-full bg-slate-800 p-4 rounded-2xl border border-slate-700
                  text-white focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/20 outline-none"
                required
              />
            </div>

            {/* Category */}
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest block mb-2">
                Category
              </label>
              <select
                name="category"
                defaultValue={idea.category ?? CATEGORIES[0]}
                className="w-full bg-slate-800 p-4 rounded-2xl border border-slate-700
                  text-white focus:border-[#0d9488] outline-none"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Context */}
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest block mb-2">
                Pitch
                <span className="normal-case text-slate-400 font-normal ml-1">(short summary)</span>
              </label>
              <input
                name="context"
                defaultValue={idea.context ?? ""}
                placeholder="One-sentence essence of your idea..."
                className="w-full bg-slate-800 p-4 rounded-2xl border border-slate-700 italic
                  text-white focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/20 outline-none"
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
                className="w-full bg-slate-800 p-4 rounded-2xl border border-slate-700 h-48
                  text-white focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/20 outline-none resize-none"
                required
              />
            </div>

            {/* Tags */}
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest block mb-2">
                Tags <span className="normal-case text-slate-400 font-normal ml-1">(comma-separated)</span>
              </label>
              <input
                name="tags"
                defaultValue={idea.tags?.join(", ") ?? ""}
                placeholder="ai, productivity, saas..."
                className="w-full bg-slate-800 p-4 rounded-2xl border border-slate-700
                  text-white focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/20 outline-none"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                className="flex-1 bg-[#0d9488] text-white py-4 rounded-2xl font-bold
                  hover:bg-teal-700 transition-all shadow-md active:scale-95"
              >
                Save Changes
              </button>
              <Link
                href={`/idea/${id}`}
                className="px-6 py-4 text-slate-400 font-medium hover:text-slate-300 transition-colors"
              >
                Cancel
              </Link>
            </div>
          </form>

          {/* Danger zone */}
          <form action={handleDelete} className="mt-6 pt-6 border-t border-slate-800">
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
