"use client";

import { useEffect, useState } from "react";

function formatDuration(ms: number): string {
  if (ms <= 0) return "Expired";

  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  parts.push(`${hours.toString().padStart(2, "0")}h`);
  parts.push(`${minutes.toString().padStart(2, "0")}m`);
  parts.push(`${seconds.toString().padStart(2, "0")}s`);

  return parts.join(" ");
}

export function Countdown({ expiresAtIso }: { expiresAtIso: string }) {
  const expiresAt = new Date(expiresAtIso).getTime();
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    // First tick is scheduled asynchronously (not a synchronous setState in
    // the effect body) to avoid cascading renders; subsequent ticks every 1s.
    const immediate = setTimeout(() => setNow(Date.now()), 0);
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearTimeout(immediate);
      clearInterval(interval);
    };
  }, []);

  if (now === null) {
    // Avoid hydration mismatch: render nothing time-dependent until mounted.
    return <span className="font-mono text-3xl font-semibold tabular-nums">--</span>;
  }

  const remaining = expiresAt - now;

  return (
    <span className="font-mono text-3xl font-semibold tabular-nums">
      {formatDuration(remaining)}
    </span>
  );
}
