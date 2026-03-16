"use client";

import { useState, useTransition } from "react";
import { Pin, PinOff } from "lucide-react";
import { pinIdea, unpinIdea } from "@/app/actions/userActions";

interface PinButtonProps {
    ideaId: string;
    initialPinned: boolean;
}

export default function PinButton({ ideaId, initialPinned }: PinButtonProps) {
    const [pinned, setPinned] = useState(initialPinned);
    const [isPending, startTransition] = useTransition();

    const handleToggle = () => {
        const next = !pinned;
        setPinned(next);
        startTransition(async () => {
            const result = next ? await pinIdea(ideaId) : await unpinIdea(ideaId);
            if (!result.success) {
                setPinned(!next); // revert
                if ("error" in result && result.error) alert(result.error);
            }
        });
    };

    return (
        <button
            onClick={handleToggle}
            disabled={isPending}
            title={pinned ? "Unpin from profile" : "Pin to profile"}
            className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg
        border transition-all disabled:opacity-50
        ${pinned
                    ? "border-[#0d9488]/40 text-[#0d9488] bg-teal-50"
                    : "border-slate-200 text-slate-400 hover:border-[#0d9488]/40 hover:text-[#0d9488]"
                }`}
        >
            {pinned ? <PinOff size={10} /> : <Pin size={10} />}
            {pinned ? "Pinned" : "Pin"}
        </button>
    );
}
