import { getPeerReviews } from "@/app/actions/commentActions";
import { getTierFromXp } from "@/lib/tier-engine";
import { Zap } from "lucide-react";

interface Props { ideaId: string; }

const AXIS_LABELS = ["Feasibility", "Originality", "Impact"] as const;

export default async function PeerReviewList({ ideaId }: Props) {
    const reviews = await getPeerReviews(ideaId);

    if (reviews.length === 0) {
        return (
            <p className="text-center text-slate-400 italic text-sm py-8">
                No peer reviews yet. Be the first to review this idea.
            </p>
        );
    }

    return (
        <div className="space-y-4">
            <h3 className="font-bold text-slate-900 text-sm">
                Peer Reviews <span className="text-slate-400 font-normal">({reviews.length})</span>
            </h3>
            {reviews.map((r) => {
                const tier = getTierFromXp(r.reviewer.xp);
                return (
                    <div key={r.id} className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-3">
                        {/* Header */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${tier.bgColor} ${tier.color}`}>
                                    {(r.reviewer.name ?? r.reviewer.id)[0].toUpperCase()}
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-slate-800">
                                        {r.reviewer.handle ? `@${r.reviewer.handle}` : r.reviewer.name ?? "Anonymous"}
                                    </p>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${tier.bgColor} ${tier.color}`}>
                                        {tier.displayName} · {r.tierWeight}× weight
                                    </span>
                                </div>
                            </div>
                            <div className="flex items-center gap-1 text-violet-600">
                                <Zap size={12} className="fill-violet-400" />
                                <span className="font-bold text-sm">{r.avgScore.toFixed(1)}</span>
                            </div>
                        </div>

                        {/* 3-Axis Bars */}
                        <div className="grid grid-cols-3 gap-3">
                            {AXIS_LABELS.map((label, i) => {
                                const keys = ["feasibility", "originality", "impact"] as const;
                                const val = r.ratings[keys[i]];
                                return (
                                    <div key={label} className="space-y-1">
                                        <div className="flex justify-between text-xs text-slate-500">
                                            <span>{label}</span>
                                            <span className="font-bold text-slate-700">{val}/5</span>
                                        </div>
                                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-teal-400 rounded-full transition-all"
                                                style={{ width: `${(val / 5) * 100}%` }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Written review */}
                        {r.comment && (
                            <p className="text-sm text-slate-600 border-t border-slate-50 pt-3">
                                {r.comment}
                            </p>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
