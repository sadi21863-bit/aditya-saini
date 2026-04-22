"use client";

import { addIdea } from "@/app/actions/ideaActions";
import { useRef, useState } from "react";
import { Lightbulb, Send } from "lucide-react";
import IdeaTextEditor from "@/components/IdeaTextEditor";

export default function IdeaForm({
  roomId,
  roomCategory,
}: {
  roomId: string;
  roomCategory?: string | null;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, setIsPending] = useState(false);
  const [content, setContent] = useState("");
  const [feedVisible, setFeedVisible] = useState(true);

  return (
    <form
      ref={formRef}
      action={async (formData) => {
        setIsPending(true);
        formData.set("roomId", roomId);
        if (roomCategory) formData.set("category", roomCategory);
        formData.set("feedVisible", feedVisible ? "true" : "false");
        await addIdea(formData);
        formRef.current?.reset();
        setContent("");
        setIsPending(false);
      }}
      className="bg-slate-900 rounded-3xl border border-slate-800 p-8"
    >
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2 bg-[#0d9488]/10 rounded-xl">
          <Lightbulb className="text-[#0d9488]" size={20} />
        </div>
        <h3 className="text-xl font-bold text-white">Post an Idea</h3>
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
            className="w-full bg-slate-800 p-4 rounded-2xl border border-slate-700 text-white
              placeholder:text-slate-500 focus:border-[#0d9488] focus:ring-2
              focus:ring-[#0d9488]/20 outline-none transition-all"
            required
          />
        </div>

        {/* Pitch */}
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest block mb-2">
            Pitch{" "}
            <span className="normal-case text-slate-400 font-normal">(short summary)</span>
          </label>
          <input
            name="context"
            placeholder="One-sentence essence of your idea..."
            className="w-full bg-slate-800 p-4 rounded-2xl border border-slate-700 text-white
              placeholder:text-slate-500 italic focus:border-[#0d9488] focus:ring-2
              focus:ring-[#0d9488]/20 outline-none transition-all"
          />
        </div>

        {/* Content */}
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest block mb-2">
            Full Content *
          </label>
          <IdeaTextEditor
            name="content"
            value={content}
            onChange={setContent}
            placeholder="Explain your idea in detail..."
            rows={7}
            required
          />
        </div>

        {/* Tags */}
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest block mb-2">
            Tags <span className="normal-case text-slate-400 font-normal">(comma-separated)</span>
          </label>
          <input
            name="tags"
            placeholder="ai, productivity, saas..."
            className="w-full bg-slate-800 p-4 rounded-2xl border border-slate-700 text-white
              placeholder:text-slate-500 focus:border-[#0d9488] focus:ring-2
              focus:ring-[#0d9488]/20 outline-none transition-all"
          />
        </div>

        {/* Feed visibility */}
        <label className="flex items-center gap-3 cursor-pointer group select-none">
          <div
            onClick={() => setFeedVisible((v) => !v)}
            className={`w-10 h-5 rounded-full transition-colors relative shrink-0
              ${feedVisible ? "bg-[#0d9488]" : "bg-slate-700"}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow
              transition-transform ${feedVisible ? "translate-x-5" : "translate-x-0"}`} />
          </div>
          <span className="text-sm text-slate-400 group-hover:text-slate-300 transition-colors">
            Show in global feed
          </span>
        </label>

        <button
          type="submit"
          disabled={isPending}
          className={`w-full py-4 rounded-2xl font-bold text-sm tracking-wide transition-all
            flex items-center justify-center gap-2 ${isPending
              ? "bg-slate-800 text-slate-500 cursor-not-allowed"
              : "bg-[#0d9488] text-white hover:bg-teal-700 active:scale-[0.98] shadow-md"
            }`}
        >
          {isPending ? "Publishing..." : <><Send size={16} /> Publish Idea</>}
        </button>
      </div>
    </form>
  );
}
