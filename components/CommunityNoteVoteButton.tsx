"use client";

import { useState } from "react";
import { voteCommunityNote } from "@/app/actions/justiceActions";
import { ThumbsUp } from "lucide-react";
import toast from "react-hot-toast";

interface Props {
    noteId: string;
    initialVotes: number;
    threshold: number;
}

export default function CommunityNoteVoteButton({ noteId, initialVotes, threshold }: Props) {
    const [votes, setVotes] = useState(initialVotes);
    const [voted, setVoted] = useState(false);
    const [loading, setLoading] = useState(false);

    async function handleVote() {
        if (voted || loading) return;
        setLoading(true);
        const res = await voteCommunityNote(noteId);
        setLoading(false);
        if (res.success) {
            setVotes(res.voteCount ?? votes + 1);
            setVoted(true);
            if ((res.voteCount ?? 0) >= threshold) {
                toast.success("Note verified by community! ✅");
            } else {
                toast.success("Vote recorded");
            }
        } else {
            toast.error("Failed to vote");
        }
    }

    return (
        <button
            onClick={handleVote}
            disabled={voted || loading}
            className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full transition ${voted
                    ? "bg-green-100 text-green-700 border border-green-200 cursor-default"
                    : "bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200"
                }`}
        >
            <ThumbsUp size={11} />
            {voted ? "Voted" : "Agree"} · {votes}/{threshold}
        </button>
    );
}
