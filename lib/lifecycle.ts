// Shared refresh-token lifecycle math (countdown + status). Single source of truth.

import { NOTIFY_THRESHOLDS_DAYS, REFRESH_TOKEN_LIFETIME_MONTHS } from "@/lib/keys";

export type TokenStatus = "valid" | "expiring-soon" | "expired-or-reauth-required";

// largest notify threshold: below it, the token counts as expiring soon
export const EXPIRING_SOON_DAYS = Math.max(...NOTIFY_THRESHOLDS_DAYS);

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export function addUtcMonthsClamped(iso: string, months: number): string | null {
  const issuedAt = new Date(iso);
  if (!Number.isFinite(issuedAt.getTime())) return null;

  const targetMonthIndex = issuedAt.getUTCMonth() + months;
  const targetYear = issuedAt.getUTCFullYear() + Math.floor(targetMonthIndex / 12);
  const targetMonth = ((targetMonthIndex % 12) + 12) % 12;
  const lastTargetDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const targetDay = Math.min(issuedAt.getUTCDate(), lastTargetDay);
  const result = new Date(
    Date.UTC(
      targetYear,
      targetMonth,
      targetDay,
      issuedAt.getUTCHours(),
      issuedAt.getUTCMinutes(),
      issuedAt.getUTCSeconds(),
      issuedAt.getUTCMilliseconds()
    )
  );

  return result.toISOString();
}

export function tokenLifecycle(
  issuedAt: string | null,
  nowMs: number,
  reauthRequired: boolean
): { expiresAtIso: string | null; daysLeft: number | null; status: TokenStatus } {
  if (!issuedAt) {
    return { expiresAtIso: null, daysLeft: null, status: "expired-or-reauth-required" };
  }

  const expiresAtIso = addUtcMonthsClamped(issuedAt, REFRESH_TOKEN_LIFETIME_MONTHS);
  if (!expiresAtIso) {
    return { expiresAtIso: null, daysLeft: null, status: "expired-or-reauth-required" };
  }

  const expiresAtMs = new Date(expiresAtIso).getTime();
  const daysLeft = Math.floor((expiresAtMs - nowMs) / MS_PER_DAY);

  let status: TokenStatus;
  if (reauthRequired || daysLeft <= 0) status = "expired-or-reauth-required";
  else if (daysLeft <= EXPIRING_SOON_DAYS) status = "expiring-soon";
  else status = "valid";

  return { expiresAtIso, daysLeft, status };
}
