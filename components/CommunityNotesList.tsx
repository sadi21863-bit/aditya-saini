import { getCommunityNotes } from "@/app/actions/justiceActions";
import CommunityNoteVoteButton from "@/components/CommunityNoteVoteButton";
import { AlertTriangle, Info, MessageSquareWarning, Sparkles } from "lucide-react";

interface Props {
    ideaId: string;
    ideaTitle: string;
    ideaContext: string;
}

async function getAiSummary(
    notes: Awaited<ReturnType<typeof getCommunityNotes>>,
    ideaTitle: string
): Promise<string | null> {
    if (notes.length === 0) return null;

    const apiKey = process.env.HUGGINGFACE_API_KEY;
    if (!apiKey) return null;

    const notesText = notes
        .map((n) =>
            `- [${n.severity === "factually_critical" ? "CRITICAL" : "INFO"}] ${n.note} (${n.status})`
        )
        .join("\n");

    const prompt = `You are a fact-checking assistant. Summarize the following community notes about the idea titled "${ideaTitle}" in 2-3 sentences. Be concise and neutral.\n\nNotes:\n${notesText}\n\nSummary:`;

    try {
        const res = await fetch(
            "https://api-inference.huggingface.co/models/meta-llama/Llama-3.2-3B-Instruct",
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    inputs: prompt,
                    parameters: {
                        max_new_tokens: 120,
                        temperature: 0.4,
                        return_full_text: false,
                    },
                }),
                next: { revalidate: 3600 },
            }
        );

        if (!res.ok) return null;
        const data = await res.json();
        return data?.[0]?.generated_text?.trim() ?? null;
    } catch {
        return null;
    }
}

export default async function CommunityNotesList({ ideaId, ideaTitle, ideaContext }: Props) {
    const notes = await getCommunityNotes(ideaId);
    const aiSummary = await getAiSummary(notes, ideaTitle);

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

            {/* FIX #35: AI processing disclosure — shown whenever the AI summary feature
                is enabled (API key present). Users must know their note content is sent
                to an external AI model for GDPR / transparency compliance. */}
            {process.env.HUGGINGFACE_API_KEY && notes.length > 0 && (
                <div className="flex items-start gap-2 mb-5 px-3 py-2.5 rounded-xl
                    bg-slate-800/60 border border-slate-700/50">
                    <Info size={12} className="text-slate-500 mt-0.5 shrink-0" />
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                        Note content is processed by an AI model (Llama 3.2) to generate a
                        moderation summary. No data is stored by the AI provider beyond this request.
                    </p>
                </div>
            )}

            {/* AI SUMMARY */}
            {aiSummary && (
                <div className="flex items-start gap-3 mb-6 p-4 bg-violet-950/30
          border border-violet-800/40 rounded-2xl">
                    <div className="p-1.5 bg-violet-500/10 rounded-lg shrink-0 mt-0.5">
                        <Sparkles size={13} className="text-violet-400" />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-violet-400 uppercase tracking-wider mb-1">
                            AI Summary · Llama 3.2
                        </p>
                        <p className="text-sm text-slate-300 leading-relaxed">{aiSummary}</p>
                    </div>
                </div>
            )}

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
                                className={`rounded-2xl border p-5 ${
                                    isCritical
                                        ? "bg-red-950/30 border-red-900/60"
                                        : "bg-amber-950/30 border-amber-900/60"
                                }`}
                            >
                                <div className="flex items-start gap-3">
                                    <div className={`mt-0.5 shrink-0 ${isCritical ? "text-red-400" : "text-amber-400"}`}>
                                        {isCritical ? <AlertTriangle size={15} /> : <Info size={15} />}
                                    </div>

                                    <div className="flex-1 space-y-2 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className={`text-[10px] font-bold uppercase tracking-wider ${
                                                isCritical ? "text-red-400" : "text-amber-400"
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

                                        <p className={`text-sm leading-relaxed ${
                                            isCritical ? "text-red-300" : "text-amber-300"
                                        }`}>
                                            {n.note}
                                        </p>

                                        <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
                                            <p className="text-xs text-slate-500">
                                                by{" "}
                                                <span className="font-semibold text-slate-400">
                                                    {n.authorHandle ? `@${n.authorHandle}` : n.authorName ?? "Anonymous"}
                                                </span>
                                            </p>
                                            <CommunityNoteVoteButton
                                                noteId={n.id}
                                                initialVotes={n.voteCount}
                                                threshold={n.threshold}
                                            />
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
