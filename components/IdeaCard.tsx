import Link from "next/link";
import { ideas } from "@/db/schema";

type Idea = typeof ideas.$inferSelect;

export default function IdeaCard({ idea }: { idea: Idea }) {
    return (
        <Link href={`/idea/${idea.id}`} className="group block">
            <div className="bg-slate-900/20 border border-slate-800 p-6 rounded-3xl hover:border-blue-500/50 transition-all">
                <div className="flex justify-between items-start mb-4">
                    <span className="text-xs font-mono text-blue-400 px-2 py-1 bg-blue-400/10 rounded-full uppercase">
                        {idea.category ?? "General"}
                    </span>
                    <span className="text-xs text-slate-500">
                        {idea.createdAt ? new Date(idea.createdAt).toLocaleDateString() : ""}
                    </span>
                </div>
                <h2 className="text-xl font-bold text-white group-hover:text-blue-400 transition-colors">
                    {idea.title}
                </h2>
                <p className="text-slate-400 mt-2 line-clamp-2 italic">"{idea.hook}"</p>
                <div className="mt-6 flex items-center gap-4 text-slate-500 text-sm">
                    <span>⚡ {idea.totalLikes ?? 0} Likes</span>
                </div>
            </div>
        </Link>
    );
}
