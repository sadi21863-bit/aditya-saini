import { db } from "@/db";
import { ideas } from "@/db/schema";
import { eq } from "drizzle-orm";
import { updateIdea, deleteIdea } from "@/app/actions/ideaActions";
import { CATEGORIES } from "@/lib/categories";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Shield, ShieldCheck, ShieldOff, Lock } from "lucide-react";

const PROTECTION_OPTIONS = [
  { value: "open", label: "Open", description: "Fully visible to everyone", Icon: ShieldOff },
  { value: "guarded", label: "Guarded", description: "Text cannot be selected/highlighted", Icon: Shield },
  { value: "shielded", label: "Shielded", description: "Copy, right-click & select-all blocked", Icon: ShieldCheck },
  { value: "vault", label: "Vault", description: "Content blurred until viewer Likes it", Icon: Lock },
] as const;

export default async function EditIdea({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = await params;
  const id = resolvedParams.id;

  const [idea] = await db.select().from(ideas).where(eq(ideas.id, id));
  if (!idea) notFound();

  // ── Wrap in void-returning server actions so <form action> is happy ──
  async function handleUpdate(formData: FormData): Promise<void> {
    "use server";
    await updateIdea(id, formData);
  }

  async function handleDelete(): Promise<void> {
    "use server";
    await deleteIdea(id);
  }

  return (
    <main className="min-h-screen bg-[#f8fafb] p-8">
      <div className="max-w-2xl mx-auto">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-slate-400 hover:text-[#0d9488]
            font-semibold text-sm mb-8 transition-colors group"
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

          <form action={handleUpdate} className="flex flex-col gap-6">

            {/* Title */}
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest block mb-2">
                Title
              </label>
              <input
                name="title"
                defaultValue={idea.title}
                className="w-full bg-slate-50 p-4 rounded-2xl border border-slate-200
                  focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/20 outline-none"
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
                className="w-full bg-slate-50 p-4 rounded-2xl border border-slate-200
                  focus:border-[#0d9488] outline-none"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Context */}
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest block mb-2">
                Public Pitch
                <span className="normal-case text-slate-400 font-normal ml-1">(always visible)</span>
              </label>
              <input
                name="context"
                defaultValue={idea.context ?? ""}
                placeholder="One-sentence essence of your idea..."
                className="w-full bg-slate-50 p-4 rounded-2xl border border-slate-200 italic
                  focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/20 outline-none"
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
                className="w-full bg-slate-50 p-4 rounded-2xl border border-slate-200 h-48
                  focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/20 outline-none resize-none"
                required
              />
            </div>

            {/* IP Protection Level */}
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest block mb-3">
                IP Protection Level
              </label>
              <div className="grid grid-cols-2 gap-2">
                {PROTECTION_OPTIONS.map(({ value, label, description, Icon }) => (
                  <label
                    key={value}
                    className="relative flex items-start gap-3 p-4 rounded-2xl border
                      border-slate-200 bg-slate-50 cursor-pointer hover:border-[#0d9488]/40
                      has-[:checked]:border-[#0d9488] has-[:checked]:bg-teal-50 transition-all"
                  >
                    <input
                      type="radio"
                      name="protectionLevel"
                      value={value}
                      defaultChecked={(idea.protectionLevel ?? "open") === value}
                      className="mt-0.5 accent-[#0d9488]"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <Icon size={13} className="text-slate-500 shrink-0" />
                        <span className="text-sm font-bold text-slate-900">{label}</span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">{description}</p>
                    </div>
                  </label>
                ))}
              </div>
              {idea.genesisHash && (
                <p className="text-[11px] text-emerald-600 mt-2 italic">
                  ✓ Genesis hash locked — protection level is independent of your timestamp proof.
                </p>
              )}
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
                className="px-6 py-4 text-slate-400 font-medium hover:text-slate-600 transition-colors"
              >
                Cancel
              </Link>
            </div>
          </form>

          {/* Danger zone */}
          <form action={handleDelete} className="mt-6 pt-6 border-t border-slate-100">
            <button
              type="submit"
              className="w-full text-red-400 text-sm font-semibold hover:text-red-600
                transition-colors py-2"
            >
              Delete this Idea
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
