"use client";

import { useState } from "react";
import { X } from "lucide-react";

export default function EmailSaveCard({ debateId, shareToken }: { debateId: string; shareToken: string }) {
  const [dismissed, setDismissed] = useState(false);
  const [email,     setEmail]     = useState("");
  const [status,    setStatus]    = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMsg,  setErrorMsg]  = useState<string | null>(null);

  if (dismissed) return null;

  async function handleSend() {
    if (!email.trim()) return;
    setStatus("sending"); setErrorMsg(null);
    try {
      const res  = await fetch(`/api/debates/${debateId}/save-email`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email, shareToken }),
      });
      const data = await res.json();
      if (!res.ok) { setErrorMsg(data.error ?? "Failed to send."); setStatus("error"); return; }
      setStatus("sent");
    } catch {
      setErrorMsg("Something went wrong. Try again.");
      setStatus("error");
    }
  }

  if (status === "sent") {
    return (
      <div className="rounded-xl border border-ic-border bg-ic-card p-4 text-sm text-ic-fg">
        ✓ Sent! Check your inbox.
      </div>
    );
  }

  return (
    <div className="relative rounded-xl border border-ic-border bg-ic-card p-4">
      <button
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        className="absolute right-3 top-3 text-ic-muted hover:text-ic-fg transition"
      >
        <X className="w-3.5 h-3.5" />
      </button>

      <p className="text-sm font-medium text-ic-fg mb-3 pr-6">
        💾 Want a link to this debate? We'll email it to you.
      </p>

      <div className="flex gap-2">
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="flex-1 rounded-lg border border-ic-border bg-transparent px-3 py-2 text-sm
                     text-ic-fg placeholder:text-ic-muted focus:outline-none focus:ring-2
                     focus:ring-ic-accent"
        />
        <button
          onClick={handleSend}
          disabled={status === "sending" || !email.trim()}
          className="rounded-lg bg-ic-accent px-4 py-2 text-sm font-medium text-white
                     hover:opacity-90 disabled:opacity-50 transition"
        >
          {status === "sending" ? "Sending…" : "Send link"}
        </button>
      </div>

      {errorMsg && <p className="mt-2 text-xs text-ic-danger">{errorMsg}</p>}
    </div>
  );
}
