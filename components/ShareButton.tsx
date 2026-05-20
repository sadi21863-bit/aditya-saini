"use client";

import { useState } from "react";

export function ShareButton() {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <button
      onClick={copy}
      className="font-mono text-[12px] text-ic-muted hover:text-ic-ink transition-colors"
    >
      {copied ? "Copied!" : "Copy link"}
    </button>
  );
}
