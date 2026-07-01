// Redis key-name constants and the per-profile key factory. Pure string logic —
// no storage access here (see lib/profiles.ts for the stateful profile layer).

// The implicit profile that every existing single-token install migrates into,
// and the target of `/api/token` when no ?profile= is given.
export const DEFAULT_PROFILE = "default";

// Profile ids become Redis key segments AND env-var suffixes, so keep them to a
// safe, predictable charset.
export const PROFILE_ID_PATTERN = /^[a-z0-9-]{1,32}$/;
export function isValidProfileId(id: string): boolean {
  return PROFILE_ID_PATTERN.test(id);
}

// Registry of known profile ids (JSON array of strings).
export const PROFILES_REGISTRY_KEY = "spotify:profiles";

// Legacy (pre-v1.5) single-token keys, migrated into the `default` profile.
export const LEGACY_KEYS = {
  refreshToken: "spotify:refresh_token",
  refreshTokenIssuedAt: "spotify:refresh_token:issued_at",
  accessToken: "spotify:access_token",
  reauthRequired: "spotify:reauth_required",
  lastRefresh: "spotify:last_refresh",
  scopes: "spotify:scopes",
  notified: (days: number) => `spotify:notified:${days}`,
} as const;

/** All Redis keys for a single profile, namespaced under `spotify:{profile}:`. */
export function keysFor(profile: string) {
  const base = `spotify:${profile}`;
  return {
    refreshToken: `${base}:refresh_token`,
    refreshTokenIssuedAt: `${base}:refresh_token:issued_at`,
    accessToken: `${base}:access_token`,
    reauthRequired: `${base}:reauth_required`,
    lastRefresh: `${base}:last_refresh`,
    scopes: `${base}:scopes`,
    refreshLock: `${base}:refresh_lock`,
    enabled: `${base}:enabled`,
    accountId: `${base}:account_id`,
    displayName: `${base}:display_name`,
    clientId: `${base}:client_id`,
    clientSecretEnc: `${base}:client_secret_enc`,
    notified: (days: number) => `${base}:notified:${days}`,
  } as const;
}

export type ProfileKeys = ReturnType<typeof keysFor>;

export const NOTIFY_THRESHOLDS_DAYS = [14, 7, 1] as const;

export const SIX_MONTHS_MS = 1000 * 60 * 60 * 24 * 30 * 6; // 30-day months, matches Spotify's ~6mo window
