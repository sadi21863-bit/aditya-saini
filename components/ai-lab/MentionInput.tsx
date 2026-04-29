"use client";

import { useState, useTransition } from "react";
import { Send, Lock, Loader2 } from "lucide-react";
import type { MentionInput as MentionInputType, MentionResult } from "@/app/actions/ai-mention-actions";

interface MentionInputProps {
  ideaId:        string;
  roomId:        string;
  roomIsPrivate: boolean;
  viewerId:      string; // empty string = unauthenticated
  onSubmit:      (input: MentionInputType) => Promise<MentionResult>;
}

const AI_MENTION_RE = /(?:^|\s)@(llama|gpt-oss|qwen|ai|random)\b/i;

function hasAIMention(text: string): boolean {
  return AI_MENTION_RE.test(text);
}

function formatResetTime(resetAt: Date): string {
  const diffMs = new Date(resetAt).getTime() - Date.now();
  if (diffMs <= 0) return "soon";
  const h = Math.floor(diffMs / 3_600_000);
  const m = Math.floor((diffMs % 3_600_000) / 60_000);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function MentionInput({
  ideaId, roomId, roomIsPrivate, viewerId, onSubmit,
}: MentionInputProps) {
  const [text,        setText]       = useState("");
  const [echoChoice,  setEchoChoice] = useState<"private" | "public">("private");
  const [status,      setStatus]     = useState<"idle" | "success" | "error" | "rate_limited">("idle");
  const [message,     setMessage]    = useState("");
  const [resetAt,     setResetAt]    = useState<Date | null>(null);
  const [isPending, startTransition] = useTransition();

  const hasMention   = hasAIMention(text);
  const showRadios   = !roomIsPrivate && hasMention;
  const effectiveEcho: "private" | "public" = roomIsPrivate ? "private" : echoChoice;

  function handleSubmit() {
    if (!viewerId) {
      setStatus("error");
      setMessage("Sign in to ask the AI");
      return;
    }
    if (!text.trim()) {
      setStatus("error");
      setMessage("Write something first");
      return;
    }
    if (!hasMention) {
      setStatus("error");
      setMessage("Include @llama, @gpt-oss, @qwen, or @ai to ask the AI");
      return;
    }

    setStatus("idle");
    startTransition(async () => {
      const result = await onSubmit({
        roomId,
        ideaId,
        content:    text.trim(),
        echoChoice: effectiveEcho,
      });

      if (result.success) {
        setStatus("success");
        setMessage("Your question was sent. Expect a reply in 10–30 minutes.");
        setText("");
      } else if (result.error === "rate_limit_exceeded") {
        setStatus("rate_limited");
        setResetAt(result.resetAt ?? null);
        setMessage(`You've used your 3 daily AI questions. Resets in ${result.resetAt ? formatResetTime(result.resetAt) : "a while"}.`);
      } else if (result.error === "unauthenticated") {
        setStatus("error");
        setMessage("Sign in to ask the AI");
      } else {
        setStatus("error");
        setMessage(result.error ?? "Something went wrong. Try again.");
      }
    });
  }

  return (
    <div className="mb-8">
      <div className="flex gap-3">
        <div className="w-8 h-8 rounded-full bg-[#0d9488]/20 flex items-center justify-center shrink-0 mt-0.5">
          <span className="text-[#0d9488] text-xs font-bold">?</span>
        </div>
        <div className="flex-1">
          <textarea
            value={text}
            onChange={(e) => { setText(e.target.value); setStatus("idle"); }}
            placeholder="Ask an AI… include @llama, @gpt-oss, @qwen, or @ai"
            maxLength={1000}
            rows={3}
            disabled={isPending}
            className="w-full px-4 py-3 rounded-xl border border-slate-700 bg-slate-900
              text-white text-sm resize-none focus:outline-none focus:ring-2
              focus:ring-[#0d9488]/40 focus:border-[#0d9488] placeholder:text-slate-500 transition
              disabled:opacity-50"
          />

          {/* Helper text */}
          <p className="text-slate-500 text-xs mt-1">
            Mention an AI: @llama @gpt-oss @qwen @ai (random)
          </p>

          {/* Privacy choice */}
          {roomIsPrivate ? (
            <div className="flex items-center gap-1.5 mt-2 text-slate-400 text-xs">
              <Lock size={11} />
              <span>Private rooms always stay private</span>
            </div>
          ) : showRadios ? (
            <div className="mt-2 flex flex-col gap-1.5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name={`echo-${ideaId}`}
                  value="private"
                  checked={echoChoice === "private"}
                  onChange={() => setEchoChoice("private")}
                  className="accent-teal-500"
                />
                <span className="text-xs text-slate-300">Just answer me <span className="text-slate-500">(reply stays here)</span></span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name={`echo-${ideaId}`}
                  value="public"
                  checked={echoChoice === "public"}
                  onChange={() => setEchoChoice("public")}
                  className="accent-teal-500"
                />
                <span className="text-xs text-slate-300">Answer + discuss in Lab <span className="text-slate-500">(reply here + AI Lab discussion)</span></span>
              </label>
            </div>
          ) : null}

          {/* Status messages */}
          {status === "success" && (
            <p className="text-teal-400 text-xs mt-2">{message}</p>
          )}
          {(status === "error" || status === "rate_limited") && (
            <p className="text-red-400 text-xs mt-2">{message}</p>
          )}

          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-slate-500">{text.length}/1000</span>
            <button
              onClick={handleSubmit}
              disabled={isPending || !text.trim()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0d9488] text-white
                text-xs font-bold hover:bg-teal-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {isPending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
              {isPending ? "Asking…" : "Ask AI"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
