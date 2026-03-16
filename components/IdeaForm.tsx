"use client";

import { addIdea } from "@/app/actions/ideaActions";
import { useRef, useState } from "react";
import { Lightbulb, Save } from "lucide-react";
import { CATEGORIES } from "@/lib/categories";
import IdeaTextEditor from "@/components/IdeaTextEditor";
import FlairPicker from "@/components/FlairPicker";
import type { FlairValue } from "@/lib/flair";

export default function IdeaForm({
  existingCategories = [],
}: {
  existingCategories?: string[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, setIsPending] = useState(false);
  const [content, setContent] = useState("");
  const [flair, setFlair] = useState<FlairValue | null>(null);

  const allCategories = Array.from(new Set([...CATEGORIES, ...existingCategories]));

  return (
    <form
      ref={formRef}
      action={async (formData) => {
        setIsPending(true);
        // Inject flair manually since it's not a native input
        if (flair) formData.set("flair", flair);
        await addIdea(formData);
        formRef.current?.reset();
        setContent("");
        setFlair(null);
        setIsPending(false);
      }}
      className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8"
    >
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2 bg-[#0d9488]/10 rounded-xl">
          <Lightbulb className="text-[#0d9488]" size={20} />
        </div>
        <h3
          className="text-xl font-bold text-slate-900"
          style={{ fontFamily: "var(--font-playfair)" }}
        >
          Idea Details
        </h3>
      </div>

      <div className="space-y-5">

        {/* Title */}
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest block mb-2">
            Title *
          </label>
          <input
            name="title"
            placeholder="e.g. Solar Powered Desalination"
            className="w-full bg-slate-50 p-4 rounded-2xl border border-slate-200 text-slate-900
              placeholder:text-slate-400 focus:border-[#0d9488] focus:ring-2
              focus:ring-[#0d9488]/20 outline-none transition-all"
            required
          />
        </div>

        {/* Category */}
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest block mb-2">
            Category *
          </label>
          <input
            name="category"
            list="category-list"
            placeholder="e.g. Energy, Tech, Social"
            className="w-full bg-slate-50 p-4 rounded-2xl border border-slate-200 text-slate-900
              placeholder:text-slate-400 focus:border-[#0d9488] focus:ring-2
              focus:ring-[#0d9488]/20 outline-none transition-all"
            required
          />
          <datalist id="category-list">
            {allCategories.map((cat) => (
              <option key={cat} value={cat} />
            ))}
          </datalist>
        </div>

        {/* Flair */}
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest block mb-2">
            Status Flair{" "}
            <span className="normal-case text-slate-400 font-normal">
              (optional — what stage is this idea?)
            </span>
          </label>
          <FlairPicker value={flair} onChange={setFlair} />
        </div>

        {/* Public Pitch */}
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest block mb-2">
            Public Pitch{" "}
            <span className="normal-case text-slate-400 font-normal">
              (always visible — your hook)
            </span>
          </label>
          <input
            name="context"
            placeholder="The one-sentence essence of your idea..."
            className="w-full bg-slate-50 p-4 rounded-2xl border border-slate-200 text-slate-900
              placeholder:text-slate-400 italic focus:border-[#0d9488] focus:ring-2
              focus:ring-[#0d9488]/20 outline-none transition-all"
          />
        </div>

        {/* Full Content */}
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest block mb-2">
            Full Content *
          </label>
          <IdeaTextEditor
            name="content"
            value={content}
            onChange={setContent}
            placeholder="Explain your idea in detail — how it works, why it matters, what it needs..."
            rows={7}
            required
          />
        </div>

        <button
          type="submit"
          disabled={isPending}
          className={`w-full py-4 rounded-2xl font-bold text-sm tracking-wide transition-all
            flex items-center justify-center gap-2 ${isPending
              ? "bg-slate-100 text-slate-400 cursor-not-allowed"
              : "bg-[#0d9488] text-white hover:bg-teal-700 active:scale-[0.98] shadow-md"
            }`}
        >
          {isPending ? (
            "Saving to Dashboard..."
          ) : (
            <>
              <Save size={16} /> Save to Dashboard
            </>
          )}
        </button>
      </div>
    </form>
  );
}
