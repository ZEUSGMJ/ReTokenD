// Redis key names. Pure string logic; the stateful layer is lib/profiles.ts.

export const DEFAULT_PROFILE = "default";

// ids double as Redis key segments and env-var suffixes
export const PROFILE_ID_PATTERN = /^[a-z0-9-]{1,32}$/;
export function isValidProfileId(id: string): boolean {
  return PROFILE_ID_PATTERN.test(id);
}

export const PROFILES_REGISTRY_KEY = "spotify:profiles";

// pre-profile keys, migrated into `default` on first init
export const LEGACY_KEYS = {
  refreshToken: "spotify:refresh_token",
  refreshTokenIssuedAt: "spotify:refresh_token:issued_at",
  accessToken: "spotify:access_token",
  reauthRequired: "spotify:reauth_required",
  lastRefresh: "spotify:last_refresh",
  scopes: "spotify:scopes",
  notified: (days: number) => `spotify:notified:${days}`,
} as const;

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
    notifiedReauth: `${base}:notified:reauth`,
    notified: (days: number) => `${base}:notified:${days}`,
  } as const;
}

export type ProfileKeys = ReturnType<typeof keysFor>;

export const NOTIFY_THRESHOLDS_DAYS = [14, 7, 1] as const;

export const SIX_MONTHS_MS = 1000 * 60 * 60 * 24 * 30 * 6; // Spotify's ~6mo expiry window
