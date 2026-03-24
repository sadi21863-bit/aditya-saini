// components/RegistrySearchTabs.tsx
'use client';

import { Search, Lightbulb, Users as UsersIcon, Hash } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

// Note: This component uses useSearchParams() which requires a <Suspense> boundary.
// FIX #24: registry/page.tsx wraps this in <Suspense fallback={<div />}>.
type SearchType = "all" | "ideas" | "creators" | "category";

export default function RegistrySearchTabs() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const currentType = (searchParams.get("type") || "all") as SearchType;

    const handleTypeChange = (type: SearchType) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set("type", type);
        router.push(`/registry?${params.toString()}`);
    };

    const tabs = [
        { type: "all" as SearchType, icon: Search, label: "All" },
        { type: "ideas" as SearchType, icon: Lightbulb, label: "Ideas" },
        { type: "creators" as SearchType, icon: UsersIcon, label: "Creators" },
        { type: "category" as SearchType, icon: Hash, label: "Category" },
    ];

    return (
        <div className="flex gap-2 flex-wrap">
            {tabs.map(({ type, icon: Icon, label }) => (
                <button
                    key={type}
                    type="button"
                    onClick={() => handleTypeChange(type)}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                        currentType === type
                            ? "bg-[#0d9488] text-white"
                            : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                    }`}
                >
                    <span className="flex items-center gap-2">
                        <Icon size={14} />
                        {label}
                    </span>
                </button>
            ))}
        </div>
    );
}
