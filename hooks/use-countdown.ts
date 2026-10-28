"use client";

import * as React from "react";

/**
 * Counts down locally from a server-provided number of seconds (so device
 * clock skew doesn't matter). Re-syncs whenever `seconds` changes.
 */
export function useCountdown(seconds: number | null): number {
  const [left, setLeft] = React.useState(seconds ?? 0);
  React.useEffect(() => {
    if (seconds == null) return;
    const end = Date.now() + seconds * 1000;
    setLeft(seconds);
    const id = window.setInterval(() => {
      const s = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      setLeft(s);
      if (s === 0) window.clearInterval(id);
    }, 250);
    return () => window.clearInterval(id);
  }, [seconds]);
  return left;
}

export function formatMMSS(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
