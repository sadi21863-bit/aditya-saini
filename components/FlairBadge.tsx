import { getFlairMeta } from "@/lib/flair";

interface FlairBadgeProps {
    flair: string | null | undefined;
    size?: "sm" | "xs";
}

export default function FlairBadge({ flair, size = "xs" }: FlairBadgeProps) {
    if (!flair) return null;

    const meta = getFlairMeta(flair);

    // #56: instead of returning null for unknown flairs, show a neutral gray fallback
    const colorClass = meta?.color ?? "bg-slate-100 text-slate-500 border-slate-200";
    const label = meta?.label ?? flair;

    return (
        <span
            className={`inline-flex items-center border rounded-full font-bold whitespace-nowrap
        ${colorClass}
        ${size === "xs" ? "text-[9px] px-1.5 py-0.5" : "text-[11px] px-2.5 py-1"}`}
        >
            {label}
        </span>
    );
}
