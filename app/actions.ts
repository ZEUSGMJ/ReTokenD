"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { storage } from "@/lib/storage";
import { DEFAULT_PROFILE, isValidProfileId, keysFor, SIX_MONTHS_MS } from "@/lib/keys";
import { SESSION_COOKIE_NAME } from "@/lib/session";
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

  const keys = keysFor(profile);
  const [issuedAt, reauthRequired] = await Promise.all([
    storage.get<string>(keys.refreshTokenIssuedAt),
    storage.get<string>(keys.reauthRequired),
  ]);

  const expiresAtIso = issuedAt
    ? new Date(new Date(issuedAt).getTime() + SIX_MONTHS_MS).toISOString()
    : null;
  const daysLeft = expiresAtIso
    ? Math.floor((new Date(expiresAtIso).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  let statusLabel: string;
  if (!reauthRequired && daysLeft !== null && daysLeft > 14) {
    statusLabel = "Valid";
  } else if (!reauthRequired && daysLeft !== null && daysLeft > 0) {
    statusLabel = "Expiring Soon";
  } else {
    statusLabel = "Expired / Re-auth Required";
  }

  const embed = buildStatusEmbed({
    description: "Test Notification",
    statusLabel,
    daysLeft,
    expiresAtIso,
    footer: "Test from Dashboard",
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
