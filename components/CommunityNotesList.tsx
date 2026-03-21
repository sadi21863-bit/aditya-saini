import { getCommunityNotes } from "@/app/actions/justiceActions";
import CommunityNoteVoteButton from "@/components/CommunityNoteVoteButton";
import { AlertTriangle, Info, MessageSquareWarning } from "lucide-react";

interface Props { ideaId: string; }

export default async function CommunityNotesList({ ideaId }: Props) {
    const notes = await getCommunityNotes(ideaId);

    return (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl px-8 py-7">

            {/* Header */}
            <div className="flex items-center gap-2.5 mb-5">
                <div className="p-1.5 bg-amber-500/10 rounded-lg">
                    <MessageSquareWarning size={15} className="text-amber-400" />
                </div>
                <h3 className="text-sm font-bold text-slate-200">Community Notes</h3>
                {notes.length > 0 && (
                    <span className="ml-auto text-[10px] bg-amber-500/10 text-amber-400
            border border-amber-500/20 px-2 py-0.5 rounded-full font-bold uppercase">
                        {notes.length} note{notes.length !== 1 ? "s" : ""}
                    </span>
                )}
            </div>

            {notes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
                    <div className="w-10 h-10 rounded-2xl bg-slate-800 flex items-center justify-center">
                        <MessageSquareWarning size={18} className="text-slate-600" />
                    </div>
                    <p className="text-sm text-slate-500 font-medium">No community notes yet</p>
                    <p className="text-xs text-slate-600 max-w-xs">
                        Community members can flag misleading or factually incorrect claims on this idea.
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {notes.map((n) => {
                        const isCritical = n.severity === "factually_critical";
                        const isVerified = n.status === "verified";
                        const isPending = n.status === "pending";

                        return (
                            <div
                                key={n.id}
                                className={`rounded-2xl border p-5 ${isCritical
                                    ? "bg-red-950/30 border-red-900/60"
                                    : "bg-amber-950/30 border-amber-900/60"
                                    }`}
                            >
                                <div className="flex items-start gap-3">
                                    <div className={`mt-0.5 shrink-0 ${isCritical ? "text-red-400" : "text-amber-400"}`}>
                                        {isCritical ? <AlertTriangle size={15} /> : <Info size={15} />}
                                    </div>

                                    <div className="flex-1 space-y-2 min-w-0">
                                        {/* Status badges */}
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className={`text-[10px] font-bold uppercase tracking-wider ${isCritical ? "text-red-400" : "text-amber-400"
                                                }`}>
                                                {isCritical ? "⚠️ Factually Critical" : "ℹ️ Community Note"}
                                            </span>

                                            {isVerified && (
                                                <span className="text-[10px] bg-emerald-900/40 text-emerald-400
                          border border-emerald-800 px-2 py-0.5 rounded-full font-bold">
                                                    ✓ Verified · {n.voteCount}/{n.threshold} votes
                                                </span>
                                            )}
                                            {isPending && (
                                                <span className="text-[10px] bg-slate-800 text-slate-400
                          border border-slate-700 px-2 py-0.5 rounded-full font-bold">
                                                    Pending · {n.voteCount}/{n.threshold} votes
                                                </span>
                                            )}
                                        </div>

                                        {/* Note text */}
                                        <p className={`text-sm leading-relaxed ${isCritical ? "text-red-300" : "text-amber-300"
                                            }`}>
                                            {n.note}
                                        </p>

                                        {/* Footer row */}
                                        <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
                                            <p className="text-xs text-slate-500">
                                                by{" "}
                                                <span className="font-semibold text-slate-400">
                                                    {n.authorHandle ? `@${n.authorHandle}` : n.authorName ?? "Anonymous"}
                                                </span>
                                            </p>
                                            <CommunityNoteVoteButton noteId={n.id} ideaId={ideaId} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
