// Profile registry, enabled flags, and one-time legacy migration.

import { storage } from "@/lib/storage";
import {
  allKeysFor,
  DEFAULT_PROFILE,
  isValidProfileId,
  LEGACY_KEYS,
  NOTIFY_THRESHOLDS_DAYS,
  PROFILES_REGISTRY_KEY,
  keysFor,
} from "@/lib/keys";

// hot-reload-safe singletons
const globalForProfiles = globalThis as unknown as {
  __retokendProfilesInit?: Promise<void>;
  __retokendRegistryChain?: Promise<unknown>;
};

// in-process mutex for registry read-modify-write; per-instance on serverless
function withRegistryLock<T>(fn: () => Promise<T>): Promise<T> {
  const prev = globalForProfiles.__retokendRegistryChain ?? Promise.resolve();
  const run = prev.then(fn, fn);
  globalForProfiles.__retokendRegistryChain = run.catch(() => {});
  return run;
}

/** Seed registry + migrate legacy data on first use. Single-flight; failures retry. */
export async function ensureInitialized(): Promise<void> {
  if (globalForProfiles.__retokendProfilesInit) return globalForProfiles.__retokendProfilesInit;
  const run = withRegistryLock(initializeRegistry);
  globalForProfiles.__retokendProfilesInit = run;
  try {
    await run;
  } catch (err) {
    globalForProfiles.__retokendProfilesInit = undefined; // allow retry
    throw err;
  }
}

async function initializeRegistry(): Promise<void> {
  const registry = await storage.get<string[]>(PROFILES_REGISTRY_KEY);
  if (Array.isArray(registry) && registry.length > 0) return;

  const dk = keysFor(DEFAULT_PROFILE);

  const [legacyRefresh, defaultRefresh, legacyScopes, defaultScopes] = await Promise.all([
    storage.get<string>(LEGACY_KEYS.refreshToken),
    storage.get<string>(dk.refreshToken),
    storage.get<string[]>(LEGACY_KEYS.scopes),
    storage.get<string[]>(dk.scopes),
  ]);

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

  if (legacyScopes !== null && defaultScopes === null) {
    await storage.set(dk.scopes, legacyScopes);
  }

  await storage.set(dk.enabled, "1");
  await storage.set(PROFILES_REGISTRY_KEY, [DEFAULT_PROFILE]);
}

export async function listProfiles(): Promise<string[]> {
  await ensureInitialized();
  return (await storage.get<string[]>(PROFILES_REGISTRY_KEY)) ?? [];
}

export async function profileExists(id: string): Promise<boolean> {
  return (await listProfiles()).includes(id);
}

/** Enabled unless explicitly "0". */
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

/** Add profile to registry and enable it, if not already present. */
export async function registerProfile(id: string): Promise<void> {
  if (!isValidProfileId(id)) throw new Error(`invalid profile id: ${id}`);
  await ensureInitialized();
  await withRegistryLock(async () => {
    const registry = (await storage.get<string[]>(PROFILES_REGISTRY_KEY)) ?? [];
    if (!registry.includes(id)) {
      await storage.set(PROFILES_REGISTRY_KEY, [...registry, id]);
    }
    if ((await storage.get<string>(keysFor(id).enabled)) === null) {
      await storage.set(keysFor(id).enabled, "1");
    }
  });
}

/** Purge a profile's keys and drop it from the registry. `default` is protected. */
export async function deleteProfile(id: string): Promise<void> {
  if (id === DEFAULT_PROFILE) return;
  if (!isValidProfileId(id)) throw new Error(`invalid profile id: ${id}`);

  // registry removal must precede the key purge, or concurrent writers can resurrect keys
  await withRegistryLock(async () => {
    const registry = (await storage.get<string[]>(PROFILES_REGISTRY_KEY)) ?? [];
    await storage.set(
      PROFILES_REGISTRY_KEY,
      registry.filter((p) => p !== id)
    );
  });

  // derived purge list — new keys added to keysFor are removed automatically
  await storage.del(...allKeysFor(id));
}

/** Clears the re-auth + all threshold notification dedupe flags (used on re-auth). */
export async function clearNotificationFlags(profile: string): Promise<void> {
  const keys = keysFor(profile);
  await storage.del(
    keys.notifiedReauth,
    ...NOTIFY_THRESHOLDS_DAYS.map((d) => keys.notified(d))
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
