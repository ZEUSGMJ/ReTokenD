// node:crypto — not importable from proxy.ts / lib/session.ts (Edge runtime)

import { timingSafeEqual } from "node:crypto";

export function constantTimeEquals(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

export function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET ?? "";
  if (secret.length === 0) {
    throw new Error("SESSION_SECRET is not set — refusing to sign cookies with an empty key.");
  }
  return secret;
}

export function bearerMatches(authHeader: string, secret: string): boolean {
  if (!secret || !authHeader) return false;
  const expected = `Bearer ${secret}`;
  if (authHeader.length !== expected.length) return false;
  return constantTimeEquals(authHeader, expected);
}
