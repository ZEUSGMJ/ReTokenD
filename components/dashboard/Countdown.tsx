"use client";

import { useEffect, useState } from "react";
import type { TokenStatus } from "@/lib/lifecycle";

function formatDuration(ms: number): string {
  if (!Number.isFinite(ms)) return "--";
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

interface CountdownProps {
  issuedAtIso: string;
  expiresAtIso: string;
  status: TokenStatus;
}

export function Countdown({ issuedAtIso, expiresAtIso, status }: CountdownProps) {
  const issuedAt = new Date(issuedAtIso).getTime();
  const expiresAt = new Date(expiresAtIso).getTime();
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    // async first tick avoids a cascading render from setState in the effect body
    const immediate = setTimeout(() => setNow(Date.now()), 0);
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearTimeout(immediate);
      clearInterval(interval);
    };
  }, []);

  if (now === null) {
    // nothing time-dependent before mount (hydration mismatch)
    return (
      <div className="flex w-full flex-col items-center gap-2">
        <span className="font-mono text-3xl font-semibold tabular-nums">--</span>
        <p className="text-sm text-muted-foreground">until refresh token expires</p>
        <div className="h-2 w-full max-w-md rounded-full bg-muted opacity-0" aria-hidden="true" />
      </div>
    );
  }

  const remaining = expiresAt - now;
  const lifetime = expiresAt - issuedAt;
  const remainingPercent =
    Number.isFinite(lifetime) && lifetime > 0
      ? Math.min(100, Math.max(0, (remaining / lifetime) * 100))
      : 0;
  const progress = status === "expired-or-reauth-required" ? 0 : remainingPercent;
  const roundedProgress = Math.round(progress);
  const trackColor =
    status === "valid"
      ? "bg-emerald-500/20"
      : status === "expiring-soon"
        ? "bg-amber-500/20"
        : "bg-destructive/20";
  const fillColor =
    status === "valid"
      ? "bg-emerald-500"
      : status === "expiring-soon"
        ? "bg-amber-500"
        : "bg-destructive";
  const valueText =
    status === "expired-or-reauth-required"
      ? "Reauthorization required"
      : `${roundedProgress}% of refresh token lifetime remaining`;

  return (
    <div className="flex w-full flex-col items-center gap-2">
      <span className="font-mono text-3xl font-semibold tabular-nums">
        {formatDuration(remaining)}
      </span>
      <p className="text-sm text-muted-foreground">until refresh token expires</p>
      <div
        role="progressbar"
        aria-label="Refresh token lifetime remaining"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={roundedProgress}
        aria-valuetext={valueText}
        className={`h-2 w-full max-w-md overflow-hidden rounded-full ${trackColor}`}
      >
        <div
          className={`h-full origin-left rounded-full ${fillColor}`}
          style={{ transform: `scaleX(${progress / 100})` }}
        />
      </div>
    </div>
  );
}
