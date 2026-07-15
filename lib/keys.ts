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
  reauthRequired: "spotify:reauth_required",
  lastRefresh: "spotify:last_refresh",
  scopes: "spotify:scopes",
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

// ascending; callers rely on this order (smallest threshold fires first)
export const NOTIFY_THRESHOLDS_DAYS = [1, 7, 14] as const;

export const REFRESH_TOKEN_LIFETIME_MONTHS = 6;

/** Every Redis key a profile can own — the purge list for deleteProfile. */
export function allKeysFor(profile: string): string[] {
  const keys = keysFor(profile);
  const staticKeys = (Object.values(keys) as unknown[]).filter(
    (v): v is string => typeof v === "string"
  );
  return [...staticKeys, ...NOTIFY_THRESHOLDS_DAYS.map((d) => keys.notified(d))];
}
