"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { launchIdea, recallIdea, deleteIdea } from "@/app/actions/ideaActions";
import { Rocket, RotateCcw, Trash2 } from "lucide-react";
import toast from "react-hot-toast";

interface Props {
  ideaId: string;
  status: string;
}

export default function HangarActions({ ideaId, status }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function handleLaunch() {
    setLoading("launch");
    const res = await launchIdea(ideaId);
    setLoading(null);
    if (res.success) {
      toast.success("Idea launched! 🚀");
      router.refresh();
    } else {
      toast.error(res.error ?? "Failed to launch");
    }
  }

  async function handleRecall() {
    setLoading("recall");
    const res = await recallIdea(ideaId);
    setLoading(null);
    if (res.success) {
      toast.success("Idea recalled to drafts");
      router.refresh();
    } else {
      toast.error(res.error ?? "Failed to recall");
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this idea? This cannot be undone.")) return;
    setLoading("delete");
    const res = await deleteIdea(ideaId);
    setLoading(null);
    if (res.success) {
      toast.success("Idea deleted");
      router.push("/dashboard");
    } else {
      toast.error(res.error ?? "Failed to delete");
    }
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {status === "draft" && (
        <button
          onClick={handleLaunch}
          disabled={loading === "launch"}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl
            bg-[#0d9488] text-white text-xs font-bold hover:bg-teal-700
            transition-colors disabled:opacity-50"
        >
          <Rocket size={13} />
          {loading === "launch" ? "Launching..." : "Launch"}
        </button>
      )}

      {status === "public" && (
        <button
          onClick={handleRecall}
          disabled={loading === "recall"}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl
            bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-bold
            hover:bg-amber-500/20 transition-colors disabled:opacity-50"
        >
          <RotateCcw size={13} />
          {loading === "recall" ? "Recalling..." : "Recall"}
        </button>
      )}

      <button
        onClick={handleDelete}
        disabled={loading === "delete"}
        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl
          bg-red-500/10 text-red-400 border border-red-500/20 text-xs font-bold
          hover:bg-red-500/20 transition-colors disabled:opacity-50"
      >
        <Trash2 size={13} />
        {loading === "delete" ? "Deleting..." : "Delete"}
      </button>
    </div>
  );
}
