"use client";

import React, { useState, useEffect } from "react";
import { Zap, Save, Info, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { saveToHangar } from "@/app/actions/visionActions";
import IdeaTextEditor from "@/components/IdeaTextEditor";
// FIX #33: Import shared scoreIdea from lib — removes duplicate inline logic
import { scoreIdea } from "@/lib/scoreIdea";

export default function DraftingLab() {
  const [form, setForm] = useState({ title: "", context: "", content: "", category: "" });
  const [luminosity, setLuminosity] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error" | ""; text: string }>({ type: "", text: "" });

  // FIX #15: Track the saved draft's id so subsequent saves UPDATE instead of INSERT
  const [savedIdeaId, setSavedIdeaId] = useState<string | null>(null);

  useEffect(() => {
    setLuminosity(scoreIdea(form.content, form.category));
  }, [form]);

  const handleSave = async () => {
    if (!form.title || !form.content) {
      setMessage({ type: "error", text: "Title and content are required." });
      return;
    }
    setIsSaving(true);
    setMessage({ type: "", text: "" });
    try {
      // FIX #15: Pass savedIdeaId so visionActions updates the existing draft
      const result = await saveToHangar({
        title: form.title,
        context: form.context,
        content: form.content,
        category: form.category || "General",
        ideaId: savedIdeaId ?? undefined,
      });
      if (result.success) {
        // FIX #15: Persist the id returned so future saves hit the same row
        if (result.id) setSavedIdeaId(result.id);
        setMessage({ type: "success", text: savedIdeaId ? "Draft updated!" : "Saved to Dashboard!" });
      } else {
        setMessage({ type: "error", text: "Failed to save. Please try again." });
      }
    } catch {
      setMessage({ type: "error", text: "Server error. Please try again." });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-8 bg-white rounded-3xl border border-slate-100 shadow-sm">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-900" style={{ fontFamily: "var(--font-playfair)" }}>
            Drafting Lab
          </h2>
          <p className="text-slate-500 text-sm mt-1">Build a high-quality idea before publishing.</p>
        </div>
        <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200">
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Score</p>
            <p className={`text-lg font-bold font-mono ${luminosity >= 80 ? "text-[#0d9488]" : "text-amber-500"}`}>
              {luminosity}%
            </p>
          </div>
          <div className="w-16 h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 rounded-full ${luminosity >= 80 ? "bg-[#0d9488]" : "bg-amber-400"}`}
              style={{ width: `${luminosity}%` }}
            />
          </div>
        </div>
      </div>

      <div className="space-y-5">
        <input
          placeholder="Vision Title *"
          className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl focus:ring-2
            focus:ring-[#0d9488]/20 focus:border-[#0d9488] outline-none font-bold text-slate-900
            placeholder:text-slate-400"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
        />
        <input
          placeholder="Category (e.g. Tech, Design, Social)"
          className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl focus:ring-2
            focus:ring-[#0d9488]/20 focus:border-[#0d9488] outline-none text-slate-900
            placeholder:text-slate-400"
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
        />
        <textarea
          placeholder="Public Pitch — one sentence that captures the idea's essence"
          maxLength={280}
          className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl focus:ring-2
            focus:ring-[#0d9488]/20 focus:border-[#0d9488] outline-none italic text-slate-600
            placeholder:text-slate-400 resize-none"
          rows={2}
          value={form.context}
          onChange={(e) => setForm({ ...form, context: e.target.value })}
        />

        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest block mb-2">
            Full Content *{" "}
            <span className="normal-case font-normal text-slate-400">
              (aim for 250+ words, use ## headings and * bullets to boost score)
            </span>
          </label>
          <IdeaTextEditor
            name="content"
            value={form.content}
            onChange={(val) => setForm((f) => ({ ...f, content: val }))}
            placeholder="Full content — aim for 250+ words..."
            rows={9}
            required
          />
        </div>
      </div>

      {message.text && (
        <div
          className={`mt-5 p-4 rounded-2xl flex items-center gap-3 border text-sm font-medium ${
            message.type === "success"
              ? "bg-teal-50 border-teal-200 text-teal-700"
              : "bg-red-50 border-red-200 text-red-600"
          }`}
        >
          {message.type === "success" ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          {message.text}
        </div>
      )}

      <div className="mt-6 flex justify-between items-center pt-6 border-t border-slate-100">
        <div className="flex items-center gap-2 text-slate-400 text-xs italic">
          <Info size={13} /> Ideas are saved as drafts — launch them from the Dashboard.
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 px-6 py-3 rounded-2xl font-bold bg-[#0d9488] text-white
            hover:bg-teal-700 disabled:bg-slate-200 disabled:text-slate-400 transition-all shadow-md"
        >
          {isSaving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
          {savedIdeaId ? "Update Draft" : "Save to Dashboard"}
        </button>
      </div>
    </div>
  );
}
