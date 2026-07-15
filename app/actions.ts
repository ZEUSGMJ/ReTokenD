"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { storage } from "@/lib/storage";
import { DEFAULT_PROFILE, isValidProfileId, keysFor } from "@/lib/keys";
import { tokenLifecycle, type TokenStatus } from "@/lib/lifecycle";
import { SESSION_COOKIE_NAME } from "@/lib/session";
import { bumpSessionGeneration } from "@/lib/session-server";
import { ALL_SCOPE_IDS } from "@/lib/spotify";
import {
  deleteProfile as removeProfile,
  profileExists,
  registerProfile,
  setProfileEnabled,
} from "@/lib/profiles";
import { notify, buildStatusEmbed } from "@/lib/notify";
import { encryptSecret } from "@/lib/crypto";

export async function logout() {
  // bump the generation first so every outstanding cookie is revoked server-side
  await bumpSessionGeneration();
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
  redirect("/login");
}

/** Whitelisted against the catalog; applied on the next re-auth. */
export async function saveScopes(formData: FormData) {
  const profile = String(formData.get("profile") ?? DEFAULT_PROFILE);
  if (!isValidProfileId(profile)) return;
  if (!(await profileExists(profile))) return;

  const selected = formData
    .getAll("scopes")
    .map((v) => String(v))
    .filter((id) => ALL_SCOPE_IDS.has(id));

  await storage.set(keysFor(profile).scopes, selected);
  revalidatePath("/");
}

export async function testNotification(formData: FormData) {
  const profile = String(formData.get("profile") ?? DEFAULT_PROFILE);
  if (!isValidProfileId(profile)) return;
  if (!(await profileExists(profile))) return;

  const keys = keysFor(profile);
  const [issuedAt, reauthRequired] = await Promise.all([
    storage.get<string>(keys.refreshTokenIssuedAt),
    storage.get<string>(keys.reauthRequired),
  ]);

  const { expiresAtIso, daysLeft, status } = tokenLifecycle(
    issuedAt,
    Date.now(),
    Boolean(reauthRequired)
  );

  const STATUS_LABELS: Record<TokenStatus, string> = {
    valid: "Valid",
    "expiring-soon": "Expiring Soon",
    "expired-or-reauth-required": "Expired / Re-auth Required",
  };
  const statusLabel = STATUS_LABELS[status];

  const embed = buildStatusEmbed({
    description: "Test notification",
    statusLabel,
    daysLeft,
    expiresAtIso,
    footer: "Sent from the dashboard",
    profile,
  });

  await notify(`Test notification from ReTokenD [${profile}]`, [embed]);
}

export async function toggleProfileEnabled(formData: FormData) {
  const profile = String(formData.get("profile") ?? "");
  if (!isValidProfileId(profile)) return;
  if (!(await profileExists(profile))) return;
  const enabled = String(formData.get("enabled") ?? "") === "1";
  await setProfileEnabled(profile, enabled);
  revalidatePath("/");
}

export interface CreateProfileState {
  error?: string;
}

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

/** A blank secret keeps the stored one, so the client id can be edited alone. */
export async function saveProfileCredentials(
  _prev: CredentialsState,
  formData: FormData
): Promise<CredentialsState> {
  const profile = String(formData.get("profile") ?? "");
  if (!isValidProfileId(profile)) return { error: "invalid_profile" };
  if (!(await profileExists(profile))) return { error: "invalid_profile" };

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

export async function deleteProfile(formData: FormData) {
  const profile = String(formData.get("profile") ?? "");
  if (!isValidProfileId(profile) || profile === DEFAULT_PROFILE) return;
  if (!(await profileExists(profile))) return;
  await removeProfile(profile);
  revalidatePath("/");
}

/** Falls back to the env/global Spotify app. */
export async function clearProfileCredentials(formData: FormData) {
  const profile = String(formData.get("profile") ?? "");
  if (!isValidProfileId(profile)) return;
  if (!(await profileExists(profile))) return;
  const keys = keysFor(profile);
  await storage.del(keys.clientId, keys.clientSecretEnc);
  revalidatePath("/");
}
