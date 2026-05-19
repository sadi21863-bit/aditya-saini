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

  const inputCls = "w-full bg-ic-card border border-ic-rule rounded-xl p-4 text-ic-ink placeholder:text-ic-muted focus:border-ic-accent outline-none transition font-sans text-sm";
  const labelCls = "font-mono text-[12px] text-ic-muted uppercase tracking-wide block mb-2";

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
      className="bg-ic-card border border-ic-rule rounded-2xl p-8"
    >
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2 bg-ic-accent/10 rounded-xl">
          <Lightbulb className="text-ic-accent" size={20} />
        </div>
        <h3 className="font-display text-xl text-ic-ink">Post an Idea</h3>
      </div>

      <div className="space-y-5">
        {/* Title */}
        <div>
          <label className={labelCls}>Title *</label>
          <input
            name="title"
            placeholder="e.g. Solar Powered Desalination"
            className={inputCls}
            required
          />
        </div>

        {/* Pitch */}
        <div>
          <label className={labelCls}>
            Pitch{" "}
            <span className="normal-case text-ic-muted font-normal">(short summary)</span>
          </label>
          <input
            name="context"
            placeholder="One-sentence essence of your idea..."
            className={`${inputCls} italic`}
          />
        </div>

        {/* Content */}
        <div>
          <label className={labelCls}>Full Content *</label>
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
          <label className={labelCls}>
            Tags{" "}
            <span className="normal-case text-ic-muted font-normal">(comma-separated)</span>
          </label>
          <input
            name="tags"
            placeholder="ai, productivity, saas..."
            className={inputCls}
          />
        </div>

        {/* Feed visibility toggle */}
        <label className="flex items-center gap-3 cursor-pointer group select-none">
          <div
            onClick={() => setFeedVisible((v) => !v)}
            className={`w-10 h-5 rounded-full transition-colors relative shrink-0
              ${feedVisible ? "bg-ic-accent" : "bg-ic-rule"}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-ic-paper shadow
              transition-transform ${feedVisible ? "translate-x-5" : "translate-x-0"}`} />
          </div>
          <span className="text-sm text-ic-muted group-hover:text-ic-ink transition-colors">
            Show in global feed
          </span>
        </label>

        <button
          type="submit"
          disabled={isPending}
          className={`w-full py-4 rounded-2xl font-medium text-sm tracking-wide transition-all
            flex items-center justify-center gap-2 ${isPending
              ? "bg-ic-paper-deep text-ic-muted cursor-not-allowed"
              : "bg-ic-accent text-white hover:opacity-90 active:scale-[0.98]"
            }`}
        >
          {isPending ? "Publishing..." : <><Send size={16} /> Publish Idea</>}
        </button>
      </div>
    </form>
  );
}
