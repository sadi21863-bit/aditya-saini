"use client";

import { addIdea } from "@/app/actions/ideaActions";
import { useRef, useState } from "react";
import { Lightbulb, Save, Shield, ShieldCheck, ShieldOff, Lock } from "lucide-react";
import { CATEGORIES } from "@/lib/categories";

const BLUR_OPTIONS = [
  { value: 0, label: "Open",     Icon: ShieldOff,   description: "Fully public" },
  { value: 1, label: "Guarded",  Icon: Shield,      description: "No text select" },
  { value: 2, label: "Shielded", Icon: ShieldCheck, description: "Copy blocked" },
  { value: 3, label: "Vault",    Icon: Lock,        description: "Like to reveal" },
] as const;

export default function IdeaForm({ existingCategories = [] }: { existingCategories?: string[] }) {
  const formRef    = useRef<HTMLFormElement>(null);
  const [isPending, setIsPending] = useState(false);

  // Merge passed-in categories with the canonical list, deduped
  const allCategories = Array.from(new Set([...CATEGORIES, ...existingCategories]));

  return (
    <form
      ref={formRef}
      action={async (formData) => {
        setIsPending(true);
        await addIdea(formData);
        formRef.current?.reset();
        setIsPending(false);
      }}
      className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8"
    >
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2 bg-[#0d9488]/10 rounded-xl">
          <Lightbulb className="text-[#0d9488]" size={20} />
        </div>
        <h3 className="text-xl font-bold text-slate-900" style={{ fontFamily: "var(--font-playfair)" }}>
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
              placeholder:text-slate-400 focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/20
              outline-none transition-all"
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
              placeholder:text-slate-400 focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/20
              outline-none transition-all"
            required
          />
          <datalist id="category-list">
            {allCategories.map((cat) => <option key={cat} value={cat} />)}
          </datalist>
        </div>

        {/* Hook */}
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest block mb-2">
            Hook{" "}
            <span className="normal-case text-slate-400 font-normal">(one-sentence summary)</span>
          </label>
          <input
            name="hook"
            placeholder="The one-sentence essence of your idea..."
            className="w-full bg-slate-50 p-4 rounded-2xl border border-slate-200 text-slate-900
              placeholder:text-slate-400 italic focus:border-[#0d9488] focus:ring-2
              focus:ring-[#0d9488]/20 outline-none transition-all"
            required
          />
        </div>

        {/* Content */}
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest block mb-2">
            Full Content *
          </label>
          <textarea
            name="content"
            placeholder="Explain your idea in detail — how it works, why it matters, what it needs..."
            className="w-full bg-slate-50 p-4 rounded-2xl border border-slate-200 text-slate-900
              placeholder:text-slate-400 focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/20
              outline-none transition-all resize-none"
            rows={5}
            required
          />
        </div>

        {/* IP Protection Level */}
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest block mb-3">
            IP Protection Level
          </label>
          <div className="grid grid-cols-2 gap-2">
            {BLUR_OPTIONS.map(({ value, label, Icon, description }) => (
              <label
                key={value}
                className="flex items-center gap-3 p-3 rounded-2xl border border-slate-200
                  bg-slate-50 cursor-pointer hover:border-[#0d9488]/40
                  has-[:checked]:border-[#0d9488] has-[:checked]:bg-teal-50 transition-all"
              >
                <input
                  type="radio"
                  name="blurLevel"
                  value={value}
                  defaultChecked={value === 0}
                  className="accent-[#0d9488]"
                />
                <div>
                  <div className="flex items-center gap-1.5">
                    <Icon size={12} className="text-slate-500" />
                    <span className="text-sm font-bold text-slate-800">{label}</span>
                  </div>
                  <p className="text-[10px] text-slate-400">{description}</p>
                </div>
              </label>
            ))}
          </div>
          <p className="text-[11px] text-slate-400 mt-2 italic">
            You can change this later from the Edit page.
          </p>
        </div>

        <button
          type="submit"
          disabled={isPending}
          className={`w-full py-4 rounded-2xl font-bold text-sm tracking-wide transition-all
            flex items-center justify-center gap-2 ${
            isPending
              ? "bg-slate-100 text-slate-400 cursor-not-allowed"
              : "bg-[#0d9488] text-white hover:bg-teal-700 active:scale-[0.98] shadow-md"
          }`}
        >
          {isPending
            ? "Saving to Dashboard..."
            : <><Save size={16} /> Save to Dashboard</>
          }
        </button>
      </div>
    </form>
  );
}
