import Link from "next/link";
import { Users } from "lucide-react";

interface Props {
  room: {
    id: string;
    name: string;
    description: string | null;
    category: string | null;
    visibility: string;
    memberCount: number;
  };
  isMember?: boolean;
}

const IC_CAT_KNOWN = ["climate","urbanism","ai","biotech","games","philosophy","hardware","tools"] as const;

function catClass(cat: string | null): string {
  const c = (cat ?? "").toLowerCase();
  return IC_CAT_KNOWN.includes(c as typeof IC_CAT_KNOWN[number])
    ? `ic-cat-${c}`
    : "ic-cat-tools";
}

export default function RoomCard({ room, isMember }: Props) {
  return (
    <Link
      href={`/rooms/${room.id}`}
      className="bg-ic-card border border-ic-rule rounded-2xl p-5 hover:border-ic-accent transition-colors flex flex-col gap-3"
    >
      {/* Category chip + joined pill */}
      <div className="flex items-center gap-2">
        {room.category && (
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-mono text-[10px] font-medium tracking-wide ${catClass(room.category)}`}>
            <span className="w-1 h-1 rounded-[1px] bg-current opacity-[0.55]" />
            {room.category}
          </span>
        )}
        {isMember && (
          <span className="ml-auto font-mono text-[10px] font-medium px-2 py-0.5 rounded bg-ic-paper-deep text-ic-muted">
            Joined
          </span>
        )}
      </div>

      {/* Room name */}
      <h3 className="font-display text-xl text-ic-ink leading-snug truncate">
        {room.name}
      </h3>

      {/* Description */}
      {room.description && (
        <p className="text-sm text-ic-ink-soft line-clamp-2 flex-1">{room.description}</p>
      )}

      {/* Footer meta */}
      <div className="flex items-center gap-3 pt-2 border-t border-ic-rule-soft font-mono text-[11px] text-ic-muted mt-auto">
        <span className="flex items-center gap-1">
          <Users size={10} />
          {room.memberCount} {room.memberCount === 1 ? "member" : "members"}
        </span>
        <span className="ml-auto capitalize">
          {room.visibility}
        </span>
      </div>
    </Link>
  );
}
