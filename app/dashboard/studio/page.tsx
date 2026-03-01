"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { motion } from "framer-motion";
import { Sparkles, Loader2, ChevronRight, Hash, Archive, ArrowLeft } from "lucide-react";
import { addIdea } from "@/app/actions/ideaActions";
import { CATEGORIES } from "@/lib/categories";
import Link from "next/link";

export default function SmartStudio() {
  const [isPending, setIsPending] = useState(false);

  const { register, watch, setValue } = useForm({
    defaultValues: { title: "", category: "", description: "" },
  });

  const currentCategory = watch("category");

  return (
    <div className="min-h-screen bg-[#fafafa] py-12 px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="max-w-2xl mx-auto"
      >
        {/* BACK */}
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-slate-400 hover:text-slate-600 mb-8 transition-colors text-sm font-medium"
        >
          <ArrowLeft size={16} /> Back to Dashboard
        </Link>

        {/* HEADER */}
        <div className="text-center mb-10">
          <div className="inline-flex p-3 bg-teal-50 rounded-2xl mb-4">
            <Sparkles className="text-[#0d9488]" size={28} />
          </div>
          <h1
            className="text-4xl font-bold text-slate-900 tracking-tight"
            style={{ fontFamily: "var(--font-playfair)" }}
          >
            Idea Studio
          </h1>
          <p className="text-slate-400 mt-2 italic text-sm">
            Drafting your next big vision.
          </p>
        </div>

        {/* FORM */}
        <form
          action={async (formData) => {
            setIsPending(true);
            // Map 'description' → 'content' and 'hook' as expected by addIdea
            formData.append("content", formData.get("description") as string);
            formData.append("hook",    formData.get("description") as string);
            await addIdea(formData);
          }}
          className="bg-white p-8 md:p-10 rounded-[2.5rem] shadow-2xl shadow-slate-200/40 border border-slate-100 space-y-8"
        >
          {/* Title */}
          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-[0.2em] font-black text-slate-300 ml-1">
              Project Name
            </label>
            <input
              {...register("title")}
              name="title"
              required
              className="w-full text-2xl font-serif border-b-2 border-slate-100 focus:border-[#0d9488] outline-none py-2 transition-all placeholder:text-slate-200 bg-transparent"
              placeholder="What are we building?"
            />
          </div>

          {/* Category */}
          <div className="space-y-4">
            <label className="text-[10px] uppercase tracking-[0.2em] font-black text-slate-300 ml-1">
              Category
            </label>
            <div className="relative group">
              <Hash
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-[#0d9488] transition-colors"
                size={18}
              />
              <input
                {...register("category")}
                name="category"
                className="w-full pl-11 pr-4 py-4 bg-slate-50 rounded-2xl outline-none border border-transparent focus:border-teal-200 focus:bg-white transition-all text-slate-700 font-medium"
                placeholder="Type or pick one below..."
              />
            </div>

            {/* Quick-tags — sourced from lib/categories.ts */}
            <div className="flex flex-wrap gap-2 ml-1">
              {CATEGORIES.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setValue("category", tag)}
                  className={`text-[10px] px-3 py-1 rounded-full border transition-all uppercase tracking-wider font-bold ${
                    currentCategory === tag
                      ? "bg-teal-50 border-teal-200 text-[#0d9488]"
                      : "bg-white border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-600"
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* Description / Vision */}
          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-[0.2em] font-black text-slate-300 ml-1">
              The Vision
            </label>
            <textarea
              {...register("description")}
              name="description"
              required
              rows={4}
              className="w-full p-5 bg-slate-50 rounded-[1.5rem] outline-none focus:ring-4 focus:ring-[#0d9488]/5 transition-all text-slate-700 leading-relaxed resize-none"
              placeholder="Explain the problem and your unique solution..."
            />
          </div>

          {/* Submit */}
          <div className="pt-4 border-t border-slate-50">
            <button
              type="submit"
              disabled={isPending}
              className={`w-full py-5 rounded-[1.5rem] font-bold flex items-center justify-center gap-3 transition-all active:scale-[0.98] bg-slate-900 text-white shadow-xl shadow-slate-200 ${
                isPending ? "opacity-50 cursor-not-allowed" : "hover:bg-slate-700"
              }`}
            >
              {isPending ? (
                <Loader2 className="animate-spin" size={22} />
              ) : (
                <Archive size={20} />
              )}
              <span className="text-lg">
                {isPending ? "Saving..." : "Save to Dashboard"}
              </span>
              <ChevronRight size={18} className="opacity-40 ml-auto" />
            </button>
            <p className="text-center text-[11px] text-slate-400 mt-6 italic">
              Saved as a <span className="text-slate-600 font-bold">Draft</span> — launch it any time from the Dashboard.
            </p>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
