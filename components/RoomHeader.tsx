import Link from "next/link";
import { Globe, Lock, Settings, Users } from "lucide-react";
import type { Room } from "@/db/schema";

interface Props {
  room: Room;
  memberCount: number;
  callerRole: string | null;
}

export default function RoomHeader({ room, memberCount, callerRole }: Props) {
  const canManage = callerRole === "owner" || callerRole === "moderator";

  return (
    <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl px-6 py-5 mb-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {room.visibility === "public" ? (
              <Globe size={14} className="text-teal-500 dark:text-teal-400 shrink-0" />
            ) : (
              <Lock size={14} className="text-gray-400 dark:text-slate-500 shrink-0" />
            )}
            {room.category && (
              <span className="text-[10px] font-bold uppercase tracking-widest text-teal-500 dark:text-teal-400">
                {room.category}
              </span>
            )}
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white truncate">{room.name}</h1>
          {room.description && (
            <p className="text-gray-500 dark:text-slate-400 text-sm mt-1">{room.description}</p>
          )}
          <div className="flex items-center gap-1.5 mt-3 text-xs text-gray-400 dark:text-slate-500">
            <Users size={12} />
            <span>{memberCount} {memberCount === 1 ? "member" : "members"}</span>
            <span className="mx-1">·</span>
            <span className="capitalize">{room.visibility}</span>
          </div>
        </div>

        {canManage && (
          <Link
            href={`/rooms/${room.id}/settings`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
              text-gray-500 dark:text-slate-400 bg-gray-100 dark:bg-slate-800
              hover:bg-gray-200 dark:hover:bg-slate-700 hover:text-gray-900 dark:hover:text-white transition shrink-0"
          >
            <Settings size={13} />
            Settings
          </Link>
        )}
      </div>
    </div>
  );
}
