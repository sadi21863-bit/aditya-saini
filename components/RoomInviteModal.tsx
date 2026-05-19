"use client";

import { useState, useTransition } from "react";
import { inviteMember, generateInviteLink } from "@/app/actions/roomActions";
import { Copy, Check, Loader2, Send, Link2 } from "lucide-react";

interface Props {
  roomId: string;
}

export default function RoomInviteModal({ roomId }: Props) {
  const [handle, setHandle] = useState("");
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const [sendPending, startSend] = useTransition();
  const [linkPending, startLink] = useTransition();

  function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    const h = handle.replace(/^@/, "").trim();
    if (!h) return;
    setMsg(null);

    startSend(async () => {
      const res = await fetch(`/api/users/by-handle?handle=${encodeURIComponent(h)}`);
      if (!res.ok) { setMsg({ text: "User not found", ok: false }); return; }
      const { userId } = await res.json();
      const result = await inviteMember(roomId, userId);
      if (result.success) {
        setMsg({ text: "Invite sent!", ok: true });
        setHandle("");
      } else {
        setMsg({ text: ("error" in result ? result.error : null) ?? "Failed", ok: false });
      }
    });
  }

  function handleGenerateLink() {
    setMsg(null);
    startLink(async () => {
      const result = await generateInviteLink(roomId);
      if (result.success && "inviteCode" in result && result.inviteCode) {
        setInviteCode(result.inviteCode);
      } else {
        setMsg({ text: ("error" in result ? result.error : null) ?? "Failed", ok: false });
      }
    });
  }

  function copyLink() {
    if (!inviteCode) return;
    const url = `${window.location.origin}/rooms/join/${inviteCode}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Invite by handle */}
      <div>
        <h3 className="font-mono text-[12px] text-ic-muted uppercase tracking-wide mb-2">
          Invite by handle
        </h3>
        <form onSubmit={handleInvite} className="flex gap-2">
          <input
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            placeholder="@username"
            className="flex-1 bg-ic-card border border-ic-rule rounded-xl px-3 py-2
              text-ic-ink text-sm placeholder:text-ic-muted focus:outline-none focus:border-ic-accent transition"
          />
          <button
            type="submit"
            disabled={sendPending || !handle.trim()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-ic-accent hover:opacity-90
              disabled:opacity-50 text-white text-sm font-medium transition"
          >
            {sendPending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
            Send
          </button>
        </form>
      </div>

      {/* Copy invite link */}
      <div>
        <h3 className="font-mono text-[12px] text-ic-muted uppercase tracking-wide mb-2">
          Copy invite link
        </h3>
        {inviteCode ? (
          <div className="bg-ic-paper-deep border border-ic-rule rounded-xl flex items-center">
            <input
              readOnly
              value={`${typeof window !== "undefined" ? window.location.origin : ""}/rooms/join/${inviteCode}`}
              className="flex-1 bg-transparent text-ic-muted text-xs px-3 py-2.5 focus:outline-none truncate"
            />
            <button
              onClick={copyLink}
              className="border-l border-ic-rule px-4 py-2.5 text-ic-muted hover:text-ic-ink transition"
            >
              {copied
                ? <Check size={13} className="text-ic-accent-bright" />
                : <Copy size={13} />}
            </button>
          </div>
        ) : (
          <button
            onClick={handleGenerateLink}
            disabled={linkPending}
            className="flex items-center gap-2 px-4 py-2 rounded-xl
              border border-ic-rule text-ic-muted hover:border-ic-accent hover:text-ic-ink
              text-sm font-medium transition disabled:opacity-50"
          >
            {linkPending ? <Loader2 size={13} className="animate-spin" /> : <Link2 size={13} />}
            Generate invite link (7 days)
          </button>
        )}
      </div>

      {msg && (
        <p className={`font-mono text-[12px] ${msg.ok ? "text-ic-accent" : "text-red-500"}`}>
          {msg.text}
        </p>
      )}
    </div>
  );
}
