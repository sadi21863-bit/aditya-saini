"use client";

import { useState } from "react";
import { getBadge, BADGE_TIER_STYLES } from "@/lib/badge-engine";

interface Props {
    badges: string[];
    maxVisible?: number;
    size?: "sm" | "md";
}

export default function BadgeDisplay({ badges, maxVisible = 5, size = "md" }: Props) {
    const [expanded, setExpanded] = useState(false);

    if (!badges?.length) return null;

    const visible = expanded ? badges : badges.slice(0, maxVisible);
    const overflow = Math.max(0, badges.length - maxVisible);

    return (
        <div className="flex flex-wrap items-center gap-1.5">
            {visible.map((slug) => {
                const badge = getBadge(slug);
                if (!badge) return null;
                const style = BADGE_TIER_STYLES[badge.tier];

                return (
                    <span
                        key={slug}
                        title={badge.description}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full
              border text-[11px] font-semibold cursor-default select-none
              transition-opacity hover:opacity-80 ${style} ${size === "sm" ? "text-[10px] px-1.5" : ""
                            }`}
                    >
                        <span>{badge.emoji}</span>
                        <span>{badge.name}</span>
                    </span>
                );
            })}

            {/* #54: show expandable +N button instead of plain text */}
            {!expanded && overflow > 0 && (
                <button
                    onClick={() => setExpanded(true)}
                    title="Show all badges"
                    className="inline-flex items-center px-2 py-0.5 rounded-full border
                        border-slate-600 bg-slate-800 text-slate-400
                        text-[11px] font-semibold hover:bg-slate-700 hover:text-white
                        transition-colors cursor-pointer select-none"
                >
                    +{overflow} more
                </button>
            )}
            {expanded && badges.length > maxVisible && (
                <button
                    onClick={() => setExpanded(false)}
                    className="text-[11px] text-slate-500 hover:text-white transition-colors"
                >
                    Show less
                </button>
            )}
        </div>
    );
}
