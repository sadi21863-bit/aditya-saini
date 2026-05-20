"use client";

import { useState, useTransition } from "react";
import { Send, Lock, Loader2 } from "lucide-react";
import type { MentionInput as MentionInputType, MentionResult } from "@/app/actions/ai-mention-actions";

interface MentionInputProps {
  ideaId:        string;
  roomId:        string;
  roomIsPrivate: boolean;
  isAiLab?:      boolean;
  viewerId:      string; // empty string = unauthenticated
  onSubmit:      (input: MentionInputType) => Promise<MentionResult>;
}

const AI_MENTION_RE = /(?:^|\s)@(llama|gpt-oss|scout|maverick|ai|random)\b/i;

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
  ideaId, roomId, roomIsPrivate, isAiLab = false, viewerId, onSubmit,
}: MentionInputProps) {
  const [text,        setText]       = useState("");
  const [echoChoice,  setEchoChoice] = useState<"private" | "public">("private");
  const [status,      setStatus]     = useState<"idle" | "success" | "error" | "rate_limited">("idle");
  const [message,     setMessage]    = useState("");
  const [resetAt,     setResetAt]    = useState<Date | null>(null);
  const [isPending, startTransition] = useTransition();

  const hasMention   = hasAIMention(text);
  const showRadios   = !roomIsPrivate && !isAiLab && hasMention;
  const effectiveEcho: "private" | "public" = roomIsPrivate || isAiLab ? "private" : echoChoice;

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
      setMessage("Include @llama, @gpt-oss, @scout, @maverick, or @ai to ask the AI");
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
        const isEchoToLab = effectiveEcho === "public";
        setStatus("success");
        setMessage(
          isEchoToLab
            ? "Queued! Your AI response will arrive in ~10–30 min. The AI Lab discussion will appear within 1–3 hours."
            : "Queued! Your AI response will arrive in ~10–30 min."
        );
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
      <div className="bg-ic-paper border border-ic-rule rounded-xl focus-within:border-ic-accent transition-colors p-3">
        <textarea
          value={text}
          onChange={(e) => { setText(e.target.value); setStatus("idle"); }}
          placeholder="Ask an AI… include @llama, @gpt-oss, @scout, @maverick, or @ai"
          maxLength={1000}
          rows={3}
          disabled={isPending}
          className="w-full bg-transparent text-ic-ink text-sm resize-none focus:outline-none
            placeholder:text-ic-muted disabled:opacity-50"
        />

        {/* Helper text */}
        <p className="font-mono text-[11px] text-ic-muted mt-1">
          Mention an AI: @llama @gpt-oss @scout @maverick @ai (random)
        </p>

        {/* Privacy choice */}
        {roomIsPrivate ? (
          <div className="flex items-center gap-1.5 mt-2 text-ic-muted font-mono text-[11px]">
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
                className="accent-ic-accent"
              />
              <span className="font-mono text-[11px] text-ic-muted">
                Just answer me <span className="text-ic-muted opacity-60">(reply stays here)</span>
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name={`echo-${ideaId}`}
                value="public"
                checked={echoChoice === "public"}
                onChange={() => setEchoChoice("public")}
                className="accent-ic-accent"
              />
              <span className="font-mono text-[11px] text-ic-muted">
                Answer + discuss in Lab{" "}
                <span className="text-amber-500/80">(reply here + AI Lab discussion)</span>
              </span>
            </label>
          </div>
        ) : null}

        {/* Status messages */}
        {status === "success" && (
          <p className="font-mono text-[11px] text-ic-accent mt-2">{message}</p>
        )}
        {(status === "error" || status === "rate_limited") && (
          <p className="font-mono text-[11px] text-red-400 mt-2">{message}</p>
        )}

        <div className="flex items-center justify-between mt-2">
          <span className="font-mono text-[11px] text-ic-muted">{text.length}/1000</span>
          <button
            onClick={handleSubmit}
            disabled={isPending || !text.trim()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-ic-accent text-white
              font-mono text-xs font-medium hover:bg-ic-accent-bright disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {isPending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
            {isPending ? "Asking…" : "Ask AI"}
          </button>
        </div>
      </div>
    </div>
  );
}
