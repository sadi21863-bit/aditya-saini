"use client";

import { useState } from "react";

interface Props {
  url?: string; // explicit URL to copy; falls back to window.location.href
}

export function ShareButton({ url }: Props) {
  const [copied, setCopied] = useState(false);

  function copy() {
    const target = url ?? window.location.href;
    navigator.clipboard.writeText(target).then(() => {
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
