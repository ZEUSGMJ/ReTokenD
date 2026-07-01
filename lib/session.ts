// Edge-safe signed cookie helpers using Web Crypto (crypto.subtle).
// Must NOT depend on Node-only APIs (e.g. `jsonwebtoken`, `node:crypto`)
// because middleware.ts runs on the Edge runtime.

const encoder = new TextEncoder();

// Encode a UTF-8 string into an ArrayBuffer-backed Uint8Array. The explicit
// ArrayBuffer backing is required so the result satisfies BufferSource
// (ArrayBuffer) for crypto.subtle under strict TS lib settings — TextEncoder
// returns Uint8Array<ArrayBufferLike>, which TS rejects there.
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

/**
 * Sign an arbitrary string payload with HMAC-SHA256.
 * Cookie format: base64url(payload).base64url(HMAC(payload, secret))
 */
export async function signValue(payload: string, secret: string): Promise<string> {
  const key = await getHmacKey(secret);
  const payloadBytes = utf8Bytes(payload);
  const signature = await crypto.subtle.sign("HMAC", key, payloadBytes);
  const encodedPayload = base64UrlEncode(payloadBytes);
  const encodedSig = base64UrlEncode(new Uint8Array(signature));
  return `${encodedPayload}.${encodedSig}`;
}

/**
 * Verify a signed value produced by signValue(). Returns the original
 * payload string if valid, or null if the signature is missing/invalid.
 */
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

export const SESSION_COOKIE_NAME = "broker_session";
export const OAUTH_STATE_COOKIE_NAME = "broker_oauth_state";

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
  secret: string
): Promise<string> {
  const payload = JSON.stringify({ state, iat: Date.now() });
  return signValue(payload, secret);
}

export async function verifyOAuthStateCookie(
  value: string | undefined,
  expectedState: string,
  secret: string
): Promise<boolean> {
  if (!value) return false;
  const payload = await verifySignedValue(value, secret);
  if (!payload) return false;
  try {
    const parsed = JSON.parse(payload) as { state: string; iat: number };
    const ageSeconds = (Date.now() - parsed.iat) / 1000;
    if (ageSeconds < 0 || ageSeconds > OAUTH_STATE_MAX_AGE_SECONDS) return false;
    return parsed.state === expectedState;
  } catch {
    return false;
  }
}

export { SESSION_MAX_AGE_SECONDS, OAUTH_STATE_MAX_AGE_SECONDS };
