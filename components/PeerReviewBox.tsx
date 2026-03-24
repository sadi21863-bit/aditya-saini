"use client";

import { useState } from "react";
import { submitPeerReview } from "@/app/actions/commentActions";
import { getTierFromXp, TIER_WEIGHTS } from "@/lib/tier-engine";
import { Zap } from "lucide-react";
import toast from "react-hot-toast";

interface Props {
    ideaId: string;
    currentUserXp: number;
}

const AXES = [
    { key: "feasibility", label: "Feasibility", desc: "Can this realistically be built?" },
    { key: "originality", label: "Originality", desc: "Is this a fresh, novel concept?" },
    { key: "impact", label: "Impact", desc: "How much value could this create?" },
] as const;

// FIX #32: Removed local TIER_WEIGHTS copy — import canonical from lib/tier-engine
// so this never drifts from the authoritative definition

export default function PeerReviewBox({ ideaId, currentUserXp }: Props) {
    const [ratings, setRatings] = useState({ feasibility: 3, originality: 3, impact: 3 });
    const [comment, setComment] = useState("");
    const [loading, setLoading] = useState(false);

    const tier = getTierFromXp(currentUserXp);
    const weight = TIER_WEIGHTS[tier.name] ?? 1;
    const rawAvg = (ratings.feasibility + ratings.originality + ratings.impact) / 3;
    const finalScore = parseFloat((rawAvg * weight).toFixed(2));

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);
        const res = await submitPeerReview(ideaId, ratings, comment);
        setLoading(false);
        if (res.success) {
            toast.success(`Review submitted! Weighted score: ${res.avgScore}`);
            setComment("");
            setRatings({ feasibility: 3, originality: 3, impact: 3 });
        } else {
            toast.error(typeof res.error === "string" ? res.error : "Failed to submit review");
        }
    }

    return (
        <form onSubmit={handleSubmit} className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm space-y-5">
            <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-900 text-sm">Submit Peer Review</h3>
                <span className={`text-xs font-bold px-2 py-1 rounded-full ${tier.bgColor} ${tier.color}`}>
                    {tier.displayName} · {weight}× weight
                </span>
            </div>

            {AXES.map(({ key, label, desc }) => (
                <div key={key} className="space-y-1.5">
                    <div className="flex justify-between items-center">
                        <div>
                            <span className="text-sm font-semibold text-slate-700">{label}</span>
                            <p className="text-xs text-slate-400">{desc}</p>
                        </div>
                        <span className="text-lg font-bold text-[#0d9488] w-6 text-right">
                            {ratings[key]}
                        </span>
                    </div>
                    <input
                        type="range" min={1} max={5} step={1}
                        value={ratings[key]}
                        onChange={(e) => setRatings((r) => ({ ...r, [key]: Number(e.target.value) }))}
                        className="w-full accent-teal-500"
                    />
                    <div className="flex justify-between text-[10px] text-slate-300">
                        <span>1 — Poor</span><span>5 — Excellent</span>
                    </div>
                </div>
            ))}

            <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Add a written review (optional)..."
                maxLength={1000}
                rows={3}
                className="w-full text-sm border border-slate-200 rounded-xl px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-teal-400 text-slate-700 placeholder:text-slate-300"
            />

            <div className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3 border border-slate-100">
                <span className="text-xs text-slate-500">Weighted Score Preview</span>
                <div className="flex items-center gap-1.5">
                    <Zap size={13} className="text-violet-500 fill-violet-400" />
                    {/* Score is out of (5 * weight) — max 25 for Oracle, 5 for Dreamer */}
                    <span className="font-bold text-violet-600 text-sm">{finalScore} / {(5 * weight).toFixed(1)}</span>
                </div>
            </div>

            <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#0d9488] text-white font-semibold py-2.5 rounded-xl hover:opacity-90 transition disabled:opacity-50 text-sm"
            >
                {loading ? "Submitting..." : "Submit Review"}
            </button>
        </form>
    );
}
