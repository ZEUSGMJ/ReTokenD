// Shared refresh-token lifecycle math (countdown + status). Single source of truth.

import { NOTIFY_THRESHOLDS_DAYS, SIX_MONTHS_MS } from "@/lib/keys";

export type TokenStatus = "valid" | "expiring-soon" | "expired-or-reauth-required";

// largest notify threshold: below it, the token counts as expiring soon
export const EXPIRING_SOON_DAYS = Math.max(...NOTIFY_THRESHOLDS_DAYS);

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export function tokenLifecycle(
  issuedAt: string | null,
  nowMs: number,
  reauthRequired: boolean
): { expiresAtIso: string | null; daysLeft: number | null; status: TokenStatus } {
  if (!issuedAt) {
    return { expiresAtIso: null, daysLeft: null, status: "expired-or-reauth-required" };
  }

  const expiresAtMs = new Date(issuedAt).getTime() + SIX_MONTHS_MS;
  const expiresAtIso = new Date(expiresAtMs).toISOString();
  const daysLeft = Math.floor((expiresAtMs - nowMs) / MS_PER_DAY);

  let status: TokenStatus;
  if (reauthRequired || daysLeft <= 0) status = "expired-or-reauth-required";
  else if (daysLeft <= EXPIRING_SOON_DAYS) status = "expiring-soon";
  else status = "valid";

  return { expiresAtIso, daysLeft, status };
}
