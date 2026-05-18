import Link from "next/link";
import { Settings, Users } from "lucide-react";
import type { Room } from "@/db/schema";

interface Props {
  room: Room;
  memberCount: number;
  callerRole: string | null;
}

const IC_CAT_KNOWN = ["climate","urbanism","ai","biotech","games","philosophy","hardware","tools"] as const;
function catClass(cat: string | null): string {
  const c = (cat ?? "").toLowerCase();
  return IC_CAT_KNOWN.includes(c as typeof IC_CAT_KNOWN[number]) ? `ic-cat-${c}` : "ic-cat-tools";
}

export default function RoomHeader({ room, memberCount, callerRole }: Props) {
  const canManage = callerRole === "owner" || callerRole === "moderator";

  return (
    <div className="bg-ic-card border border-ic-rule rounded-2xl px-6 py-5 mb-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Category chip */}
          {room.category && (
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-mono text-[10px] font-medium tracking-wide mb-2 ${catClass(room.category)}`}>
              <span className="w-1 h-1 rounded-[1px] bg-current opacity-[0.55]" />
              {room.category}
            </span>
          )}

          {/* Room name */}
          <h1 className="font-display text-4xl font-normal tracking-tight text-ic-ink truncate leading-tight">
            {room.name}
          </h1>

          {/* Description */}
          {room.description && (
            <p className="text-ic-ink-soft text-sm mt-1.5 leading-relaxed">{room.description}</p>
          )}

          {/* Stats row */}
          <div className="flex items-center gap-3 mt-3 font-mono text-[11px] text-ic-muted">
            <span className="flex items-center gap-1">
              <Users size={11} />
              {memberCount} {memberCount === 1 ? "member" : "members"}
            </span>
            <span>·</span>
            <span className="capitalize">{room.visibility}</span>
          </div>
        </div>

        {/* Settings link — owners/mods only */}
        {canManage && (
          <Link
            href={`/rooms/${room.id}/settings`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-xs font-medium
              text-ic-muted border border-ic-rule hover:border-ic-accent hover:text-ic-ink transition shrink-0"
          >
            <Settings size={13} />
            Settings
          </Link>
        )}
      </div>
    </div>
  );
}
