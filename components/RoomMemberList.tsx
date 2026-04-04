import Link from "next/link";
import { Crown, Shield, User } from "lucide-react";

interface Member {
  userId: string;
  role: string;
  name: string | null;
  handle: string | null;
  avatarUrl: string | null;
}

const ROLE_ICON: Record<string, React.ReactNode> = {
  owner:     <Crown size={10} className="text-amber-400" />,
  moderator: <Shield size={10} className="text-teal-400" />,
  member:    <User size={10} className="text-slate-500" />,
};

export default function RoomMemberList({
  members,
  callerId,
}: {
  members: Member[];
  callerId: string | null;
}) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
      <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">
        Members · {members.length}
      </h3>
      <ul className="flex flex-col gap-2">
        {members.map((m) => (
          <li key={m.userId}>
            <Link
              href={m.handle ? `/profile/${m.handle}` : "#"}
              className="flex items-center gap-2.5 hover:opacity-80 transition-opacity"
            >
              <div className="w-7 h-7 rounded-full bg-teal-900 border border-teal-700 flex items-center justify-center text-[11px] font-bold text-teal-300 shrink-0">
                {m.name?.[0]?.toUpperCase() ?? "?"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <span className="text-xs font-semibold text-white truncate">
                    {m.name ?? "Unknown"}
                    {m.userId === callerId && (
                      <span className="ml-1 text-slate-500 font-normal">(you)</span>
                    )}
                  </span>
                  {ROLE_ICON[m.role]}
                </div>
                <p className="text-[10px] text-slate-500 truncate">@{m.handle ?? "—"}</p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
