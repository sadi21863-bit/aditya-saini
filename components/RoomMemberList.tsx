import Link from "next/link";
import { Crown, Shield } from "lucide-react";

interface Member {
  userId: string;
  role: string;
  name: string | null;
  handle: string | null;
  avatarUrl: string | null;
}

const ROLE_ICON: Record<string, React.ReactNode> = {
  owner:     <Crown  size={10} className="text-ic-ai-maverick-accent" />,
  moderator: <Shield size={10} className="text-ic-accent" />,
};

export default function RoomMemberList({
  members,
  callerId,
}: {
  members: Member[];
  callerId: string | null;
}) {
  const visible  = members.slice(0, 6);
  const overflow = members.length - visible.length;

  return (
    <div className="bg-ic-paper-deep border border-ic-rule rounded-2xl p-4">
      <h3 className="font-mono text-[11px] uppercase tracking-widest text-ic-muted mb-3">
        Members · {members.length}
      </h3>
      <ul className="flex flex-col gap-2.5">
        {visible.map((m) => (
          <li key={m.userId}>
            {m.handle ? (
              <Link
                href={`/profile/${m.handle}`}
                className="flex items-center gap-2.5 hover:opacity-70 transition-opacity"
              >
                <div className="w-7 h-7 rounded bg-ic-paper border border-ic-rule flex items-center justify-center font-mono text-[11px] font-semibold text-ic-muted shrink-0">
                  {m.name?.[0]?.toUpperCase() ?? "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="font-mono text-[12px] font-semibold text-ic-ink truncate">
                      {m.name ?? "Unknown"}
                      {m.userId === callerId && (
                        <span className="ml-1 text-ic-muted font-normal">(you)</span>
                      )}
                    </span>
                    {ROLE_ICON[m.role]}
                  </div>
                  <p className="font-mono text-[10px] text-ic-muted truncate">@{m.handle}</p>
                </div>
              </Link>
            ) : (
              <span className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded bg-ic-paper border border-ic-rule flex items-center justify-center font-mono text-[11px] font-semibold text-ic-muted shrink-0">
                  {m.name?.[0]?.toUpperCase() ?? "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="font-mono text-[12px] font-semibold text-ic-ink truncate">
                      {m.name ?? "Unknown"}
                      {m.userId === callerId && (
                        <span className="ml-1 text-ic-muted font-normal">(you)</span>
                      )}
                    </span>
                    {ROLE_ICON[m.role]}
                  </div>
                  <p className="font-mono text-[10px] text-ic-muted truncate">@—</p>
                </div>
              </span>
            )}
          </li>
        ))}
      </ul>

      {overflow > 0 && (
        <p className="font-mono text-[11px] text-ic-muted mt-3 pt-2 border-t border-ic-rule-soft">
          +{overflow} more
        </p>
      )}
    </div>
  );
}
