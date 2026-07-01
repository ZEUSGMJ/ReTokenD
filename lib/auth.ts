// Shared auth helpers for Node-runtime route handlers and Server Actions.
// Uses node:crypto — do NOT import this into proxy.ts or lib/session.ts
// (those run on the Edge runtime).

import { timingSafeEqual } from "node:crypto";

export function constantTimeEquals(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

export function bearerMatches(authHeader: string, secret: string): boolean {
  if (!secret || !authHeader) return false;
  const expected = `Bearer ${secret}`;
  if (authHeader.length !== expected.length) return false;
  return constantTimeEquals(authHeader, expected);
}
