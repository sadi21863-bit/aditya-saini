"use client";

import { useState } from "react";
import { Zap } from "lucide-react";
import { sparkIdea } from "@/app/actions/ideaActions";
import toast from "react-hot-toast";

interface SparkProps {
  ideaId: string;
  viewerId: string;
  initialLikes: number;
  onSuccess?: () => void;
  disabled?: boolean;
}

export default function SparkButton({
  ideaId,
  viewerId,
  initialLikes,
  onSuccess,
  disabled = false,
}: SparkProps) {
  const [count, setCount]       = useState(initialLikes);
  const [isActive, setIsActive] = useState(false);
  const [hasLiked, setHasLiked] = useState(false);

  void viewerId;

  const handleSpark = async () => {
    if (hasLiked || isActive || disabled) return;

    setIsActive(true);
    setCount((prev) => prev + 1);

    const result = await sparkIdea(ideaId);

    if (!result.success) {
      setCount((prev) => prev - 1);
      setIsActive(false);
      toast.error(result.error ?? "Could not spark idea");
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
            ? "bg-gray-100 dark:bg-slate-800 text-gray-300 dark:text-slate-600 cursor-not-allowed opacity-50"
            : hasLiked
              ? "bg-[#0d9488] text-white cursor-default shadow-md"
              : isActive
                ? "bg-[#0d9488] text-white shadow-lg"
                : "bg-gray-50 dark:bg-slate-800 text-gray-500 dark:text-slate-400 border border-gray-200 dark:border-slate-700 hover:border-[#0d9488] hover:text-[#0d9488]"
        }`}
    >
      <Zap
        size={16}
        className={`transition-all duration-300 ${isActive || hasLiked ? "fill-white rotate-12" : ""}`}
      />
      <span className="font-mono tabular-nums">{count}</span>
      {isActive && (
        <span className="absolute inset-0 rounded-full animate-ping bg-[#0d9488]/20 pointer-events-none" />
      )}
    </button>
  );
}
