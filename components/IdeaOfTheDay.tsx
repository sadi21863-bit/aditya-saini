import Link from "next/link";
import { Lightbulb, Heart, Eye, ArrowRight } from "lucide-react";

interface IdeaOfTheDayProps {
    idea: {
        id: string;
        title: string;
        context: string | null;
        category: string | null;
        totalLikes: number;
        views: number;
    };
    author: {
        name: string | null;
        handle: string | null;
        tier: string | null;
    } | null;
}

const TIER_BADGE: Record<string, string> = {
    dreamer: "bg-slate-100 text-slate-600",
    visionary: "bg-teal-50 text-teal-700",
    architect: "bg-violet-50 text-violet-700",
    oracle: "bg-amber-50 text-amber-700",
};

export default function IdeaOfTheDay({ idea, author }: IdeaOfTheDayProps) {
    const tierColor =
        TIER_BADGE[author?.tier ?? "dreamer"] ?? TIER_BADGE.dreamer;

    return (
        <Link
            href={`/idea/${idea.id}`}
            className="block mb-8 rounded-2xl overflow-hidden border border-teal-400/20
        bg-gradient-to-br from-[#0d9488]/10 via-slate-900 to-slate-900
        hover:border-teal-400/50 transition-all group"
        >
            {/* Label bar */}
            <div className="flex items-center gap-2 px-5 pt-4 pb-2">
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full
          bg-[#0d9488]/20 border border-[#0d9488]/30">
                    <Lightbulb size={11} className="text-[#0d9488]" />
                    <span className="text-[10px] font-black text-[#0d9488] uppercase tracking-widest">
                        Idea of the Day
                    </span>
                </div>
                {idea.category && (
                    <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">
                        {idea.category}
                    </span>
                )}
            </div>

            {/* Body */}
            <div className="px-5 pb-4">
                <h2
                    className="text-xl font-black text-white leading-snug
            group-hover:text-[#0d9488] transition-colors line-clamp-2 mb-2"
                    style={{ fontFamily: "var(--font-playfair)" }}
                >
                    {idea.title}
                </h2>

                {idea.context && (
                    <p className="text-sm text-slate-400 leading-relaxed line-clamp-2 mb-3">
                        {idea.context}
                    </p>
                )}

                {/* Footer row */}
                <div className="flex items-center justify-between">
                    {/* Author */}
                    <div className="flex items-center gap-2">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center
              text-[10px] font-bold ${tierColor}`}>
                            {author?.name?.[0]?.toUpperCase() ?? "?"}
                        </div>
                        <span className="text-xs text-slate-400 font-medium">
                            {author?.name ?? "Anonymous"}
                            {author?.handle && (
                                <span className="text-slate-500 ml-1">@{author.handle}</span>
                            )}
                        </span>
                    </div>

                    {/* Stats + CTA */}
                    <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1 text-xs text-slate-500">
                            <Heart size={11} className="text-rose-400" />
                            {idea.totalLikes}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-slate-500">
                            <Eye size={11} />
                            {idea.views}
                        </span>
                        <span className="flex items-center gap-1 text-xs font-bold
              text-[#0d9488] group-hover:gap-2 transition-all">
                            Explore <ArrowRight size={12} />
                        </span>
                    </div>
                </div>
            </div>
        </Link>
    );
}
