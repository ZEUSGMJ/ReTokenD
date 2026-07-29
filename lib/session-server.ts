// Node-only session helpers: server-side revocation via a generation counter.
// The Edge proxy verifies signature + age; this generation check runs where
// storage is available (dashboard page, /api/login, /api/callback, logout).

import { cookies } from "next/headers";
import { storage } from "@/lib/storage";
import { getSessionSecret } from "@/lib/auth";
import { SESSION_COOKIE_NAME, readSessionPayload, type SessionPayload } from "@/lib/session";

const SESSION_GENERATION_KEY = "session:generation";

/** Current revocation generation; defaults to "1" when unset. */
export async function getSessionGeneration(): Promise<string> {
  return (await storage.get<string>(SESSION_GENERATION_KEY)) ?? "1";
}

/** Bumps the generation, invalidating every outstanding session cookie. */
export async function bumpSessionGeneration(): Promise<void> {
  const current = Number.parseInt(await getSessionGeneration(), 10);
  const next = Number.isFinite(current) ? current + 1 : 2;
  await storage.set(SESSION_GENERATION_KEY, String(next));
}

function isCurrent(payload: SessionPayload, generation: string): boolean {
  return payload.gen === generation;
}

/** Signature + age (via readSessionPayload) AND current generation. */
export async function isSessionCurrent(): Promise<boolean> {
  const cookieStore = await cookies();
  const value = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const payload = await readSessionPayload(value, getSessionSecret());
  if (!payload) return false;
  return isCurrent(payload, await getSessionGeneration());
}

/** Throws when the cookie was revoked; the proxy cannot catch this itself. */
export async function requireCurrentSession(): Promise<void> {
  if (!(await isSessionCurrent())) throw new Error("unauthorized");
}
