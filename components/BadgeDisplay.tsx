import { getBadge, BADGE_TIER_STYLES } from "@/lib/badge-engine";

interface Props {
    badges: string[];      // array of slugs from users.badges
    maxVisible?: number;   // truncate after N (default: show all)
    size?: "sm" | "md";
}

export default function BadgeDisplay({ badges, maxVisible, size = "md" }: Props) {
    if (!badges?.length) return null;

    const visible = maxVisible ? badges.slice(0, maxVisible) : badges;
    const overflow = maxVisible ? Math.max(0, badges.length - maxVisible) : 0;

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

            {overflow > 0 && (
                <span className="text-xs text-slate-500 font-medium">
                    +{overflow} more
                </span>
            )}
        </div>
    );
}
