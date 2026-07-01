"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { storage } from "@/lib/storage";
import { REDIS_KEYS } from "@/lib/keys";
import { SESSION_COOKIE_NAME } from "@/lib/session";
import { ALL_SCOPE_IDS } from "@/lib/spotify";
import { notify, buildStatusEmbed } from "@/lib/notify";

/** Clear the admin session cookie and return to the login page. */
export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
  redirect("/login");
}

/**
 * Persist the admin's scope selection. Only ids that exist in the catalog are
 * stored (whitelist). Applied on the next re-authorization, not retroactively.
 */
export async function saveScopes(formData: FormData) {
  const selected = formData
    .getAll("scopes")
    .map((v) => String(v))
    .filter((id) => ALL_SCOPE_IDS.has(id));

  await storage.set(REDIS_KEYS.scopes, selected);
  revalidatePath("/");
}

/**
 * Send a test Discord notification with the current token state.
 */
export async function testNotification(formData: FormData) {
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
  });

  await notify("Test notification from ReTokenD – Spotify Token Broker", [embed]);
}
