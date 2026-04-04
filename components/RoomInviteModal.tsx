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
      // Look up user by handle via server; for now we pass handle and let
      // the server resolve — but inviteMember takes a userId.
      // We call a thin wrapper that accepts handle.
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
      {/* Search by handle */}
      <div>
        <h3 className="text-sm font-bold text-slate-300 mb-2">Invite by handle</h3>
        <form onSubmit={handleInvite} className="flex gap-2">
          <input
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            placeholder="@username"
            className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2
              text-white text-sm placeholder-slate-500 focus:outline-none focus:border-teal-600 transition"
          />
          <button
            type="submit"
            disabled={sendPending || !handle.trim()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500
              disabled:opacity-50 text-white text-sm font-bold transition"
          >
            {sendPending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
            Send
          </button>
        </form>
      </div>

      {/* Invite link */}
      <div>
        <h3 className="text-sm font-bold text-slate-300 mb-2">Copy invite link</h3>
        {inviteCode ? (
          <div className="flex gap-2">
            <input
              readOnly
              value={`${typeof window !== "undefined" ? window.location.origin : ""}/rooms/join/${inviteCode}`}
              className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2
                text-slate-400 text-xs focus:outline-none truncate"
            />
            <button
              onClick={copyLink}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-700 hover:bg-slate-600
                text-slate-300 hover:text-white text-sm font-bold transition"
            >
              {copied ? <Check size={13} className="text-teal-400" /> : <Copy size={13} />}
            </button>
          </div>
        ) : (
          <button
            onClick={handleGenerateLink}
            disabled={linkPending}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700
              border border-slate-700 text-slate-300 hover:text-white text-sm font-semibold transition disabled:opacity-50"
          >
            {linkPending ? <Loader2 size={13} className="animate-spin" /> : <Link2 size={13} />}
            Generate invite link (7 days)
          </button>
        )}
      </div>

      {msg && (
        <p className={`text-sm ${msg.ok ? "text-teal-400" : "text-red-400"}`}>{msg.text}</p>
      )}
    </div>
  );
}
