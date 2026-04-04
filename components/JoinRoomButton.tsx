"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { joinPublicRoom } from "@/app/actions/roomActions";
import { Loader2, UserPlus } from "lucide-react";

export default function JoinRoomButton({ roomId }: { roomId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleJoin() {
    setError(null);
    startTransition(async () => {
      const result = await joinPublicRoom(roomId);
      if (!result.success) {
        setError("error" in result ? (result.error ?? null) : null);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={handleJoin}
        disabled={isPending}
        className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl
          bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white font-bold text-sm transition"
      >
        {isPending ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
        {isPending ? "Joining…" : "Join Room"}
      </button>
      {error && <p className="text-xs text-red-400 text-center">{error}</p>}
    </div>
  );
}
