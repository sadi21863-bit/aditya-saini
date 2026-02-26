import { db } from "@/db";
import { ideas } from "@/db/schema";
import { eq } from "drizzle-orm";
import { updateIdea, deleteIdea } from "@/lib/actions";
import { notFound } from "next/navigation";
import Link from "next/link";

export default async function EditIdea({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [idea] = await db.select().from(ideas).where(eq(ideas.id, id));

  if (!idea) notFound();

  const updateIdeaWithId = updateIdea.bind(null, id);
  const deleteIdeaWithId = deleteIdea.bind(null, id);

  return (
    <main className="max-w-2xl mx-auto p-8 mt-10 bg-white rounded-3xl shadow-sm border border-slate-100">
      <h1 className="text-3xl font-black mb-6 text-slate-900">Edit Idea</h1>

      <form action={updateIdeaWithId} className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <label className="text-sm font-bold text-slate-500 ml-1">Title</label>
          <input name="title" defaultValue={idea.title} className="p-4 border rounded-2xl bg-slate-50" required />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-bold text-slate-500 ml-1">Category</label>
          <select name="category" defaultValue={idea.category ?? "Tech"} className="p-4 border rounded-2xl bg-slate-50 outline-none">
            <option value="Tech">Tech</option>
            <option value="Business">Business</option>
            <option value="Social">Social</option>
            <option value="Creative">Creative</option>
            <option value="Energy">Energy</option>
            <option value="Health">Health</option>
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-bold text-slate-500 ml-1">Hook</label>
          <input name="hook" defaultValue={idea.hook ?? ""} className="p-4 border rounded-2xl bg-slate-50 italic" placeholder="One-sentence essence..." />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-bold text-slate-500 ml-1">Content</label>
          <textarea name="content" defaultValue={idea.content ?? ""} className="p-4 border rounded-2xl bg-slate-50 h-40" required />
        </div>

        <div className="flex gap-3 pt-4">
          <button type="submit" className="flex-1 bg-teal-600 text-white py-4 rounded-2xl font-bold hover:bg-teal-700 transition-all shadow-lg active:scale-95">
            Save Changes
          </button>
          <Link href={`/idea/${id}`} className="px-6 py-4 text-slate-400 font-medium hover:text-slate-600 transition-colors">
            Cancel
          </Link>
        </div>
      </form>

      <form action={deleteIdeaWithId} className="mt-6 pt-6 border-t border-slate-100">
        <button type="submit" className="w-full text-red-400 text-sm font-bold hover:text-red-600 transition-colors">
          Delete this Idea
        </button>
      </form>
    </main>
  );
}
