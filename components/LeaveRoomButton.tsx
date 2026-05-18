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
        <p className="text-gray-500 dark:text-slate-400 text-xs text-center">
          Are you sure you want to leave this room?
        </p>
        <div className="flex gap-2">
          <button
            onClick={handleClick}
            disabled={isPending}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl
              bg-red-600 hover:bg-red-700 text-white text-xs font-medium transition
              disabled:opacity-50"
          >
            {isPending ? <Loader2 size={12} className="animate-spin" /> : <LogOut size={12} />}
            {isPending ? "Leaving…" : "Yes, leave"}
          </button>
          <button
            onClick={() => setConfirm(false)}
            className="flex-1 px-3 py-2 rounded-xl bg-ic-paper-deep border border-ic-rule
              hover:bg-ic-rule text-ic-muted text-xs font-medium transition"
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
          bg-ic-paper-deep border border-ic-rule hover:border-red-400
          text-ic-muted hover:text-red-500 text-sm font-medium transition"
      >
        <LogOut size={14} />
        Leave Room
      </button>
      {error && <p className="text-red-400 text-xs text-center">{error}</p>}
    </div>
  );
}
