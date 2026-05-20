"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function AILabRefresher() {
  const router = useRouter();
  const [secs, setSecs] = useState(0);

  useEffect(() => {
    const doRefresh = () => { router.refresh(); setSecs(0); };

    const refresh = setInterval(() => {
      if (document.visibilityState === "visible") doRefresh();
    }, 60_000);

    const tick = setInterval(() => setSecs((s) => s + 1), 1_000);

    const onVis = () => { if (document.visibilityState === "visible") doRefresh(); };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      clearInterval(refresh);
      clearInterval(tick);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [router]);

  return (
    <p className="font-mono text-[11px] text-ic-muted text-center mt-6">
      Updated {secs === 0 ? "just now" : `${secs}s ago`} · refreshes every 60s
    </p>
  );
}
