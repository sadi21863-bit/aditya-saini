"use client";

import { useState } from "react";
import { Zap } from "lucide-react";
import { sparkIdea } from "@/app/actions/ideaActions";
import toast from "react-hot-toast";

interface SparkProps {
  ideaId: string;
  initialLikes: number;
  initialHasLiked?: boolean;
  onSuccess?: () => void;
  disabled?: boolean;
}

export default function SparkButton({
  ideaId,
  initialLikes,
  initialHasLiked = false,
  onSuccess,
  disabled = false,
}: SparkProps) {
  const [count, setCount]       = useState(initialLikes);
  const [isActive, setIsActive] = useState(false);
  const [hasLiked, setHasLiked] = useState(initialHasLiked);

  const handleSpark = async () => {
    if (hasLiked || isActive || disabled) return;

    setIsActive(true);
    setCount((prev) => prev + 1);

    try {
      const result = await sparkIdea(ideaId);
      if (!result.success) {
        setCount((prev) => prev - 1);
        setIsActive(false);
        toast.error(result.error ?? "Could not spark idea");
        return;
      }
    } catch {
      setCount((prev) => prev - 1);
      setIsActive(false);
      toast.error("Could not spark idea");
      return;
    }

    setHasLiked(true);
    onSuccess?.();
    setTimeout(() => setIsActive(false), 1000);
  };

  return (
    <button
      onClick={handleSpark}
      disabled={isActive || hasLiked || disabled}
      aria-label={hasLiked ? "Already liked" : disabled ? "Cannot spark your own idea" : "Like this idea"}
      className={`relative group flex items-center gap-2.5 px-5 py-2.5 rounded-full font-bold
        text-sm transition-all duration-300 active:scale-95 select-none ${
          disabled
            ? "bg-ic-paper-deep text-ic-muted cursor-not-allowed opacity-50"
            : hasLiked
              ? "bg-ic-accent text-white cursor-default shadow-md"
              : isActive
                ? "bg-ic-accent text-white shadow-lg"
                : "bg-ic-paper-deep text-ic-muted border border-ic-rule hover:border-ic-accent hover:text-ic-accent"
        }`}
    >
      <Zap
        size={16}
        className={`transition-all duration-300 ${isActive || hasLiked ? "fill-white rotate-12" : ""}`}
      />
      <span className="font-mono tabular-nums">{count}</span>
      {isActive && (
        <span className="absolute inset-0 rounded-full animate-ping bg-ic-accent/20 pointer-events-none" />
      )}
    </button>
  );
}
