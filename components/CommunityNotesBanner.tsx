import { getCommunityNotes } from "@/app/actions/justiceActions";
import { AlertTriangle, Info } from "lucide-react";

interface Props { ideaId: string; }

export default async function CommunityNotesBanner({ ideaId }: Props) {
    const notes = await getCommunityNotes(ideaId);
    if (notes.length === 0) return null;

    return (
        <div className="space-y-3 mb-6">
            {notes.map((n) => {
                const isCritical = n.severity === "factually_critical";
                const isVerified = n.status === "verified";
                return (
                    <div
                        key={n.id}
                        className={`rounded-2xl border px-5 py-4 ${isCritical
                                ? "bg-red-50 border-red-200"
                                : "bg-amber-50 border-amber-200"
                            }`}
                    >
                        <div className="flex items-start gap-3">
                            <div className={`mt-0.5 ${isCritical ? "text-red-500" : "text-amber-500"}`}>
                                {isCritical ? <AlertTriangle size={16} /> : <Info size={16} />}
                            </div>
                            <div className="flex-1 space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className={`text-xs font-bold uppercase tracking-wide ${isCritical ? "text-red-600" : "text-amber-600"
                                        }`}>
                                        {isCritical ? "⚠️ Community Note — Factually Critical" : "ℹ️ Community Note"}
                                    </span>
                                    {isVerified && (
                                        <span className="text-[10px] bg-green-100 text-green-700 border border-green-200 px-2 py-0.5 rounded-full font-bold">
                                            Verified ({n.voteCount}/{n.threshold} votes)
                                        </span>
                                    )}
                                    {n.status === "pending" && (
                                        <span className="text-[10px] bg-slate-100 text-slate-500 border border-slate-200 px-2 py-0.5 rounded-full font-bold">
                                            Pending ({n.voteCount}/{n.threshold} votes)
                                        </span>
                                    )}
                                </div>
                                <p className={`text-sm ${isCritical ? "text-red-700" : "text-amber-700"}`}>
                                    {n.note}
                                </p>
                                <p className="text-xs text-slate-400">
                                    Submitted by{" "}
                                    <span className="font-semibold">
                                        {n.authorHandle ? `@${n.authorHandle}` : n.authorName ?? "Anonymous"}
                                    </span>
                                </p>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
