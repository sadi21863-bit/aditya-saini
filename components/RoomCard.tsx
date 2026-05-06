import Link from "next/link";
import { Globe, Users, ArrowRight } from "lucide-react";

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

export default function RoomCard({ room, isMember }: Props) {
  return (
    <Link
      href={`/rooms/${room.id}`}
      className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-5
        hover:border-teal-700/50 transition-colors group flex flex-col gap-3"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {room.category && (
            <span className="text-[10px] font-bold uppercase tracking-widest text-teal-500 dark:text-teal-400 block mb-1">
              {room.category}
            </span>
          )}
          <h3 className="text-sm font-bold text-gray-900 dark:text-white group-hover:text-teal-500 dark:group-hover:text-teal-400 transition-colors truncate">
            {room.name}
          </h3>
        </div>
        <ArrowRight
          size={14}
          className="text-gray-400 dark:text-slate-600 group-hover:text-teal-500 dark:group-hover:text-teal-400 transition-colors shrink-0 mt-0.5"
        />
      </div>

      {room.description && (
        <p className="text-xs text-gray-500 dark:text-slate-400 line-clamp-2">{room.description}</p>
      )}

      <div className="flex items-center gap-3 text-[11px] text-gray-400 dark:text-slate-500 mt-auto pt-2 border-t border-gray-100 dark:border-slate-800">
        <span className="flex items-center gap-1">
          <Users size={10} />
          {room.memberCount} {room.memberCount === 1 ? "member" : "members"}
        </span>
        <span className="flex items-center gap-1">
          <Globe size={10} />
          {room.visibility === "private" ? "Private" : "Public"}
        </span>
        {isMember && (
          <span className="ml-auto text-teal-500 dark:text-teal-400 font-semibold">Joined</span>
        )}
      </div>
    </Link>
  );
}
