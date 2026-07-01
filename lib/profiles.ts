// Stateful profile layer: the registry of known profiles, their enabled state,
// and the one-time self-heal migration of legacy single-token installs into the
// `default` profile. Everything here goes through the storage abstraction.

import { storage } from "@/lib/storage";
import {
  DEFAULT_PROFILE,
  LEGACY_KEYS,
  NOTIFY_THRESHOLDS_DAYS,
  PROFILES_REGISTRY_KEY,
  keysFor,
} from "@/lib/keys";

/**
 * Seed the profile registry on first use, migrating any legacy (pre-v1.5)
 * single-token data into the `default` profile. Idempotent: once the registry
 * exists this is a single cheap read. Existing installs heal themselves with no
 * manual step.
 */
export async function ensureInitialized(): Promise<void> {
  const registry = await storage.get<string[]>(PROFILES_REGISTRY_KEY);
  if (Array.isArray(registry) && registry.length > 0) return;

  const dk = keysFor(DEFAULT_PROFILE);

  const [legacyRefresh, defaultRefresh, legacyScopes, defaultScopes] = await Promise.all([
    storage.get<string>(LEGACY_KEYS.refreshToken),
    storage.get<string>(dk.refreshToken),
    storage.get<string[]>(LEGACY_KEYS.scopes),
    storage.get<string[]>(dk.scopes),
  ]);

  // Adopt legacy token data only if the default profile doesn't already hold a
  // token. The cached access token and notified markers are ephemeral, so we
  // deliberately don't copy them — the broker just refreshes on next use.
  if (legacyRefresh !== null && defaultRefresh === null) {
    const [issuedAt, reauth, lastRefresh] = await Promise.all([
      storage.get<string>(LEGACY_KEYS.refreshTokenIssuedAt),
      storage.get<string>(LEGACY_KEYS.reauthRequired),
      storage.get<string>(LEGACY_KEYS.lastRefresh),
    ]);
    const ops: Promise<unknown>[] = [storage.set(dk.refreshToken, legacyRefresh)];
    if (issuedAt !== null) ops.push(storage.set(dk.refreshTokenIssuedAt, issuedAt));
    if (reauth !== null) ops.push(storage.set(dk.reauthRequired, reauth));
    if (lastRefresh !== null) ops.push(storage.set(dk.lastRefresh, lastRefresh));
    await Promise.all(ops);
  }

  // Carry over a saved scope selection regardless of token presence.
  if (legacyScopes !== null && defaultScopes === null) {
    await storage.set(dk.scopes, legacyScopes);
  }

  await storage.set(dk.enabled, "1");
  await storage.set(PROFILES_REGISTRY_KEY, [DEFAULT_PROFILE]);
}

export async function listProfiles(): Promise<string[]> {
  await ensureInitialized();
  return (await storage.get<string[]>(PROFILES_REGISTRY_KEY)) ?? [DEFAULT_PROFILE];
}

export async function profileExists(id: string): Promise<boolean> {
  return (await listProfiles()).includes(id);
}

/** Enabled unless explicitly disabled, so a registry entry with no flag counts as on. */
export async function isProfileEnabled(id: string): Promise<boolean> {
  return (await storage.get<string>(keysFor(id).enabled)) !== "0";
}

export async function listEnabledProfiles(): Promise<string[]> {
  const profiles = await listProfiles();
  const flags = await Promise.all(profiles.map((p) => isProfileEnabled(p)));
  return profiles.filter((_, i) => flags[i]);
}

export async function setProfileEnabled(id: string, enabled: boolean): Promise<void> {
  await storage.set(keysFor(id).enabled, enabled ? "1" : "0");
}

/** Add a profile to the registry (and enable it) if it isn't already present. */
export async function registerProfile(id: string): Promise<void> {
  await ensureInitialized();
  const registry = (await storage.get<string[]>(PROFILES_REGISTRY_KEY)) ?? [];
  if (!registry.includes(id)) {
    await storage.set(PROFILES_REGISTRY_KEY, [...registry, id]);
  }
  if ((await storage.get<string>(keysFor(id).enabled)) === null) {
    await storage.set(keysFor(id).enabled, "1");
  }
}

/**
 * Delete a profile: purge all of its Redis keys and drop it from the registry.
 * The `default` profile can't be deleted (it's the migration target and the
 * `/api/token` fallback).
 */
export async function deleteProfile(id: string): Promise<void> {
  if (id === DEFAULT_PROFILE) return;

  const keys = keysFor(id);
  await storage.del(
    keys.refreshToken,
    keys.refreshTokenIssuedAt,
    keys.accessToken,
    keys.reauthRequired,
    keys.lastRefresh,
    keys.scopes,
    keys.refreshLock,
    keys.enabled,
    keys.accountId,
    keys.displayName,
    keys.clientId,
    keys.clientSecretEnc,
    ...NOTIFY_THRESHOLDS_DAYS.map((d) => keys.notified(d))
  );

  const registry = (await storage.get<string[]>(PROFILES_REGISTRY_KEY)) ?? [];
  await storage.set(
    PROFILES_REGISTRY_KEY,
    registry.filter((p) => p !== id)
  );
}

export interface ProfileMeta {
  accountId: string | null;
  displayName: string | null;
}

export async function getProfileMeta(id: string): Promise<ProfileMeta> {
  const keys = keysFor(id);
  const [accountId, displayName] = await Promise.all([
    storage.get<string>(keys.accountId),
    storage.get<string>(keys.displayName),
  ]);
  return { accountId, displayName };
}
