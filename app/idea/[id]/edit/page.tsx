import { db } from "@/db";
import { ideas } from "@/db/schema";
import { eq } from "drizzle-orm";
import { updateIdea, deleteIdea } from "@/app/actions/ideaActions";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

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

  const inputCls = "w-full bg-ic-card border border-ic-rule rounded-xl px-4 py-3 text-ic-ink placeholder:text-ic-muted focus:border-ic-accent outline-none transition font-sans text-sm";
  const labelCls = "font-mono text-[12px] text-ic-muted uppercase tracking-wide block mb-2";

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-2xl mx-auto">
        <Link
          href={idea.roomId ? `/rooms/${idea.roomId}` : "/dashboard"}
          className="inline-flex items-center gap-1.5 font-mono text-[12px] text-ic-muted hover:text-ic-ink transition-colors mb-8"
        >
          <ChevronLeft size={13} /> Back
        </Link>

        <div className="bg-ic-card border border-ic-rule rounded-2xl p-8">
          <h1 className="font-display text-3xl font-normal text-ic-ink mb-8">Edit Idea</h1>

          <form action={handleUpdate} className="flex flex-col gap-6">
            <div>
              <label className={labelCls}>Title</label>
              <input
                name="title"
                defaultValue={idea.title}
                className={inputCls}
                required
              />
            </div>

            <div>
              <label className={labelCls}>
                Pitch
                <span className="normal-case text-ic-muted font-normal ml-1">(short summary)</span>
              </label>
              <input
                name="context"
                defaultValue={idea.context ?? ""}
                placeholder="One-sentence essence of your idea..."
                className={`${inputCls} italic`}
              />
            </div>

            <div>
              <label className={labelCls}>Content</label>
              <textarea
                name="content"
                defaultValue={idea.content ?? ""}
                className={`${inputCls} h-48 resize-none`}
                required
              />
            </div>

            <div>
              <label className={labelCls}>
                Tags
                <span className="normal-case text-ic-muted font-normal ml-1">(comma-separated)</span>
              </label>
              <input
                name="tags"
                defaultValue={idea.tags?.join(", ") ?? ""}
                placeholder="ai, productivity, saas..."
                className={inputCls}
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                className="flex-1 bg-ic-accent hover:opacity-90 text-white py-3 rounded-xl font-medium
                  transition-all active:scale-95"
              >
                Save Changes
              </button>
              <Link
                href={`/idea/${id}`}
                className="px-6 py-3 font-mono text-[12px] text-ic-muted hover:text-ic-ink transition-colors"
              >
                Cancel
              </Link>
            </div>
          </form>

          <form action={handleDelete} className="mt-6 pt-6 border-t border-ic-rule">
            <button
              type="submit"
              className="w-full text-red-500 font-mono text-[12px] hover:text-red-600 transition-colors py-2"
            >
              Delete this Idea
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
