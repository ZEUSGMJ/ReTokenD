// Redis key-name constants. Keep all Redis key strings centralized here.

export const REDIS_KEYS = {
  refreshToken: "spotify:refresh_token",
  refreshTokenIssuedAt: "spotify:refresh_token:issued_at",
  accessToken: "spotify:access_token",
  reauthRequired: "spotify:reauth_required",
  lastRefresh: "spotify:last_refresh",
  scopes: "spotify:scopes",
  refreshLock: "spotify:refresh_lock",
  notified: (days: number) => `spotify:notified:${days}`,
} as const;

export const NOTIFY_THRESHOLDS_DAYS = [14, 7, 1] as const;

export const SIX_MONTHS_MS = 1000 * 60 * 60 * 24 * 30 * 6; // 30-day months, matches Spotify's ~6mo window
