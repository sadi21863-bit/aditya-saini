import { getFlairMeta } from "@/lib/flair";

interface FlairBadgeProps {
    flair: string | null | undefined;
    size?: "sm" | "xs";
}

export default function FlairBadge({ flair, size = "xs" }: FlairBadgeProps) {
    const meta = getFlairMeta(flair);
    if (!meta) return null;

    return (
        <span
            className={`inline-flex items-center border rounded-full font-bold whitespace-nowrap
        ${meta.color}
        ${size === "xs" ? "text-[9px] px-1.5 py-0.5" : "text-[11px] px-2.5 py-1"}`}
        >
            {meta.label}
        </span>
    );
}
