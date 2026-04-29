"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { leaveRoom } from "@/app/actions/roomActions";
import { LogOut, Loader2 } from "lucide-react";

export default function LeaveRoomButton({ roomId }: { roomId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirm, setConfirm]       = useState(false);
  const [error, setError]           = useState<string | null>(null);

  function handleClick() {
    if (!confirm) { setConfirm(true); return; }
    setError(null);
    startTransition(async () => {
      const result = await leaveRoom(roomId);
      if (result.success) {
        router.push("/dashboard");
      } else if ("error" in result) {
        const MESSAGES: Record<string, string> = {
          owner_cannot_leave:  "message" in result
            ? (result as { message: string }).message
            : "Room owners cannot leave.",
          cannot_leave_ai_lab: "You cannot leave the AI Lab room.",
          not_a_member:        "You are not a member of this room.",
        };
        setError(MESSAGES[result.error ?? ""] ?? (result.error ?? "Something went wrong"));
        setConfirm(false);
      }
    });
  }

  if (confirm) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-slate-400 text-xs text-center">
          Are you sure you want to leave this room?
        </p>
        <div className="flex gap-2">
          <button
            onClick={handleClick}
            disabled={isPending}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl
              bg-red-700 hover:bg-red-600 text-white text-xs font-semibold transition
              disabled:opacity-50"
          >
            {isPending ? <Loader2 size={12} className="animate-spin" /> : <LogOut size={12} />}
            {isPending ? "Leaving…" : "Yes, leave"}
          </button>
          <button
            onClick={() => setConfirm(false)}
            className="flex-1 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700
              text-slate-300 text-xs font-semibold transition"
          >
            Cancel
          </button>
        </div>
        {error && <p className="text-red-400 text-xs text-center">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={handleClick}
        className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl
          bg-slate-800 hover:bg-red-900/40 border border-slate-700 hover:border-red-700
          text-slate-400 hover:text-red-300 text-sm font-semibold transition"
      >
        <LogOut size={14} />
        Leave Room
      </button>
      {error && <p className="text-red-400 text-xs text-center">{error}</p>}
    </div>
  );
}
