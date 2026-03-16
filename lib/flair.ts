export const FLAIR_OPTIONS = [
    { value: "research", label: "🔬 Research", color: "bg-blue-50 text-blue-600 border-blue-200" },
    { value: "concept", label: "💡 Concept", color: "bg-yellow-50 text-yellow-600 border-yellow-200" },
    { value: "ready", label: "✅ Ready", color: "bg-green-50 text-green-600 border-green-200" },
    { value: "cofound", label: "🤝 Co-found", color: "bg-violet-50 text-violet-600 border-violet-200" },
    { value: "built", label: "🚀 Built", color: "bg-teal-50 text-[#0d9488] border-teal-200" },
] as const;

export type FlairValue = (typeof FLAIR_OPTIONS)[number]["value"];

export function getFlairMeta(value: string | null | undefined) {
    return FLAIR_OPTIONS.find((f) => f.value === value) ?? null;
}
