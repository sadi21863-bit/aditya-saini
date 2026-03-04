"use client";

import { useState } from "react";
import { Zap } from "lucide-react";
import { sparkVision } from "@/app/actions/sparkAction";

interface SparkProps {
  ideaId: string;
  viewerId: string;
  initialLikes: number;
  /** Optional: called after a successful like. Used by IdeaDetailClient to trigger blur reveal. */
  onSuccess?: () => void;
}

export default function SparkButton({
  ideaId,
  viewerId,
  initialLikes,
  onSuccess,
}: SparkProps) {
  const [count, setCount]     = useState(initialLikes);
  const [isActive, setIsActive] = useState(false);
  const [hasLiked, setHasLiked] = useState(false);

  const handleSpark = async () => {
    if (hasLiked || isActive) return;

    // Optimistic update
    setIsActive(true);
    setCount((prev) => prev + 1);

    const result = await sparkVision(ideaId, viewerId);

    if (!result.success) {
      // Roll back
      setCount((prev) => prev - 1);
      setIsActive(false);
      return;
    }

    setHasLiked(true);
    onSuccess?.();
    setTimeout(() => setIsActive(false), 1000);
  };

  return (
    <button
      onClick={handleSpark}
      disabled={isActive || hasLiked}
      aria-label={hasLiked ? "Already liked" : "Like this idea"}
      className={`relative group flex items-center gap-2.5 px-5 py-2.5 rounded-full font-bold
        text-sm transition-all duration-300 active:scale-95 select-none ${
        hasLiked
          ? "bg-[#0d9488] text-white cursor-default shadow-md"
          : isActive
          ? "bg-[#0d9488] text-white shadow-lg"
          : "bg-slate-50 text-slate-500 border border-slate-200 hover:border-[#0d9488] hover:text-[#0d9488]"
      }`}
    >
      <Zap
        size={16}
        className={`transition-all duration-300 ${
          isActive || hasLiked ? "fill-white rotate-12" : ""
        }`}
      />
      <span className="font-mono tabular-nums">{count}</span>
      {isActive && (
        <span className="absolute inset-0 rounded-full animate-ping bg-[#0d9488]/20 pointer-events-none" />
      )}
    </button>
  );
}
