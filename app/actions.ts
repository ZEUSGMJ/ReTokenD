"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { storage } from "@/lib/storage";
import { DEFAULT_PROFILE, isValidProfileId, keysFor } from "@/lib/keys";
import { SESSION_COOKIE_NAME } from "@/lib/session";
import { ALL_SCOPE_IDS } from "@/lib/spotify";
import { registerProfile, setProfileEnabled } from "@/lib/profiles";
import { notify, buildStatusEmbed } from "@/lib/notify";
import { encryptSecret } from "@/lib/crypto";

/** Clear the admin session cookie and return to the login page. */
export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
  redirect("/login");
}

/**
 * Persist a profile's scope selection. Only ids that exist in the catalog are
 * stored (whitelist). Applied on the next re-authorization, not retroactively.
 */
export async function saveScopes(formData: FormData) {
  const profile = String(formData.get("profile") ?? DEFAULT_PROFILE);
  if (!isValidProfileId(profile)) return;

  const selected = formData
    .getAll("scopes")
    .map((v) => String(v))
    .filter((id) => ALL_SCOPE_IDS.has(id));

  await storage.set(keysFor(profile).scopes, selected);
  revalidatePath("/");
}

/** Send a test Discord notification with a profile's current token state. */
export async function testNotification(formData: FormData) {
  const profile = String(formData.get("profile") ?? DEFAULT_PROFILE);
  const status = String(formData.get("status") ?? "");
  const daysLeftStr = String(formData.get("daysLeft") ?? "");
  const expiresAtIso = String(formData.get("expiresAtIso") ?? "");

  const daysLeft = daysLeftStr ? parseInt(daysLeftStr, 10) : null;

  const embed = buildStatusEmbed({
    description: "Test Notification",
    statusLabel: status === "valid" ? "Valid" : "Expiring Soon / Re-auth Required",
    daysLeft,
    expiresAtIso: expiresAtIso && expiresAtIso.length > 0 ? expiresAtIso : null,
    footer: "Test from Dashboard",
    profile,
  });

  await notify(`Test notification from ReTokenD [${profile}]`, [embed]);
}

/** Enable or disable a profile (disabled profiles are skipped by cron + /api/token). */
export async function toggleProfileEnabled(formData: FormData) {
  const profile = String(formData.get("profile") ?? "");
  if (!isValidProfileId(profile)) return;
  const enabled = String(formData.get("enabled") ?? "") === "1";
  await setProfileEnabled(profile, enabled);
  revalidatePath("/");
}

export interface CreateProfileState {
  error?: string;
}

/**
 * Create a new (empty) profile. It must still be authorized via Re-authorize.
 * Shaped for useActionState so validation errors render inline, not via the URL.
 */
export async function createProfile(
  _prev: CreateProfileState,
  formData: FormData
): Promise<CreateProfileState> {
  const id = String(formData.get("profileId") ?? "")
    .trim()
    .toLowerCase();
  if (!isValidProfileId(id)) {
    return { error: "invalid_profile" };
  }
  await registerProfile(id);
  revalidatePath("/");
  return {};
}

export interface CredentialsState {
  error?: string;
  ok?: boolean;
}

/**
 * Save a profile's own Spotify app credentials. client_id is stored plaintext
 * (it's not confidential); client_secret is encrypted at rest. A blank secret
 * leaves the existing stored secret untouched, so the id can be edited alone.
 */
export async function saveProfileCredentials(
  _prev: CredentialsState,
  formData: FormData
): Promise<CredentialsState> {
  const profile = String(formData.get("profile") ?? "");
  if (!isValidProfileId(profile)) return { error: "invalid_profile" };

  const clientId = String(formData.get("clientId") ?? "").trim();
  const clientSecret = String(formData.get("clientSecret") ?? "").trim();
  const keys = keysFor(profile);

  if (!clientId) return { error: "missing_client_id" };

  const hasStoredSecret = Boolean(await storage.get<string>(keys.clientSecretEnc));
  if (!clientSecret && !hasStoredSecret) return { error: "missing_client_secret" };

  await storage.set(keys.clientId, clientId);
  if (clientSecret) {
    await storage.set(keys.clientSecretEnc, encryptSecret(clientSecret));
  }

  revalidatePath("/");
  return { ok: true };
}

/** Remove a profile's stored credentials so it falls back to the env/global Spotify app. */
export async function clearProfileCredentials(formData: FormData) {
  const profile = String(formData.get("profile") ?? "");
  if (!isValidProfileId(profile)) return;
  const keys = keysFor(profile);
  await storage.del(keys.clientId, keys.clientSecretEnc);
  revalidatePath("/");
}
