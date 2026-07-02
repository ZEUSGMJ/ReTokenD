// Signed cookies via Web Crypto. Runs in proxy.ts (Edge) — no Node-only imports.

import { DEFAULT_PROFILE } from "@/lib/keys";

const encoder = new TextEncoder();

// ArrayBuffer-backed copy so strict TS accepts it as BufferSource for crypto.subtle
function utf8Bytes(value: string): Uint8Array<ArrayBuffer> {
  const encoded = encoder.encode(value);
  const copy = new Uint8Array(new ArrayBuffer(encoded.byteLength));
  copy.set(encoded);
  return copy;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  const binary = atob(padded + padding);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function getHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    utf8Bytes(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

/** Format: base64url(payload).base64url(HMAC-SHA256(payload, secret)) */
export async function signValue(payload: string, secret: string): Promise<string> {
  const key = await getHmacKey(secret);
  const payloadBytes = utf8Bytes(payload);
  const signature = await crypto.subtle.sign("HMAC", key, payloadBytes);
  const encodedPayload = base64UrlEncode(payloadBytes);
  const encodedSig = base64UrlEncode(new Uint8Array(signature));
  return `${encodedPayload}.${encodedSig}`;
}

/** Returns the payload if the signature is valid, else null. */
export async function verifySignedValue(
  signed: string,
  secret: string
): Promise<string | null> {
  const parts = signed.split(".");
  if (parts.length !== 2) return null;
  const [encodedPayload, encodedSig] = parts;

  let payloadBytes: Uint8Array<ArrayBuffer>;
  let sigBytes: Uint8Array<ArrayBuffer>;
  try {
    payloadBytes = base64UrlDecode(encodedPayload);
    sigBytes = base64UrlDecode(encodedSig);
  } catch {
    return null;
  }

  const key = await getHmacKey(secret);
  const valid = await crypto.subtle.verify("HMAC", key, sigBytes, payloadBytes);
  if (!valid) return null;

  return new TextDecoder().decode(payloadBytes);
}

export const SESSION_COOKIE_NAME = "retokend_session";
export const OAUTH_STATE_COOKIE_NAME = "retokend_oauth_state";

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days
const OAUTH_STATE_MAX_AGE_SECONDS = 60 * 10; // 10 minutes

export async function createSessionCookieValue(secret: string): Promise<string> {
  const payload = JSON.stringify({ iat: Date.now() });
  return signValue(payload, secret);
}

export async function isValidSessionCookie(
  value: string | undefined,
  secret: string
): Promise<boolean> {
  if (!value) return false;
  const payload = await verifySignedValue(value, secret);
  if (!payload) return false;
  try {
    const parsed = JSON.parse(payload) as { iat: number };
    const ageSeconds = (Date.now() - parsed.iat) / 1000;
    return ageSeconds >= 0 && ageSeconds <= SESSION_MAX_AGE_SECONDS;
  } catch {
    return false;
  }
}

export async function createOAuthStateCookieValue(
  state: string,
  profile: string,
  secret: string
): Promise<string> {
  const payload = JSON.stringify({ state, profile, iat: Date.now() });
  return signValue(payload, secret);
}

/** Returns the profile from the signed state cookie, or null if missing/tampered/expired/mismatched. */
export async function verifyOAuthStateCookie(
  value: string | undefined,
  expectedState: string,
  secret: string
): Promise<{ profile: string } | null> {
  if (!value) return null;
  const payload = await verifySignedValue(value, secret);
  if (!payload) return null;
  try {
    const parsed = JSON.parse(payload) as { state: string; profile?: string; iat: number };
    const ageSeconds = (Date.now() - parsed.iat) / 1000;
    if (ageSeconds < 0 || ageSeconds > OAUTH_STATE_MAX_AGE_SECONDS) return null;
    if (parsed.state !== expectedState) return null;
    return { profile: parsed.profile ?? DEFAULT_PROFILE };
  } catch {
    return null;
  }
}

export { SESSION_MAX_AGE_SECONDS, OAUTH_STATE_MAX_AGE_SECONDS };
