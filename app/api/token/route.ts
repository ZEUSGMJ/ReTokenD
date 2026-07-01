import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/lib/storage";
import { REDIS_KEYS } from "@/lib/keys";
import { refreshAccessToken } from "@/lib/spotify";
import { bearerMatches } from "@/lib/auth";

export const runtime = "nodejs";

// Read the cached access token and compute expires_at from its remaining TTL.
async function readCachedAccessToken(): Promise<{ access_token: string; expires_at: number } | null> {
  const cachedAccessToken = await storage.get<string>(REDIS_KEYS.accessToken);
  if (!cachedAccessToken) return null;
  const ttl = await storage.ttl(REDIS_KEYS.accessToken);
  const expiresAt = Date.now() + Math.max(ttl, 0) * 1000;
  return { access_token: cachedAccessToken, expires_at: expiresAt };
}

export async function GET(request: NextRequest) {
  const brokerSecret = process.env.BROKER_SECRET ?? "";
  const authHeader = request.headers.get("authorization") ?? "";

  if (!bearerMatches(authHeader, brokerSecret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Serve cached access token if present.
  const cached = await readCachedAccessToken();
  if (cached) {
    return NextResponse.json(cached);
  }

  const refreshToken = await storage.get<string>(REDIS_KEYS.refreshToken);
  if (!refreshToken) {
    return NextResponse.json({ error: "reauth_required" }, { status: 409 });
  }

  // Single-flight: only one request should hit Spotify's refresh endpoint at
  // a time. Losers poll the access-token cache briefly, then fall through to
  // a normal refresh as a safety valve if the winner doesn't finish in time.
  const gotLock = await storage.acquireLock(REDIS_KEYS.refreshLock, 10);

  if (!gotLock) {
    for (let i = 0; i < 10; i++) {
      await new Promise((r) => setTimeout(r, 200));
      const cachedWhilePolling = await readCachedAccessToken();
      if (cachedWhilePolling) {
        return NextResponse.json(cachedWhilePolling);
      }
    }
    // Timed out waiting for the lock holder — fall through and refresh anyway.
  }

  try {
    const result = await refreshAccessToken(refreshToken);

    if (!result.ok) {
      if (result.invalidGrant) {
        // Do NOT retry. Flag for re-auth.
        await storage.set(REDIS_KEYS.reauthRequired, "1");
        return NextResponse.json({ error: "reauth_required" }, { status: 409 });
      }
      console.error("Spotify refresh failed", result.error);
      return NextResponse.json({ error: "spotify_error" }, { status: 502 });
    }

    const { access_token, expires_in, refresh_token: newRefreshToken } = result.data;
    const ttlSeconds = Math.max(expires_in - 60, 60);
    const nowIso = new Date().toISOString();

    const ops: Promise<unknown>[] = [
      storage.setWithTTL(REDIS_KEYS.accessToken, access_token, ttlSeconds),
      storage.set(REDIS_KEYS.lastRefresh, nowIso),
    ];

    // If Spotify rotated the refresh token, store the new one — but NEVER
    // touch issued_at here; that is only set on full re-auth in /api/callback.
    if (newRefreshToken && newRefreshToken !== refreshToken) {
      ops.push(storage.set(REDIS_KEYS.refreshToken, newRefreshToken));
    }

    await Promise.all(ops);

    const expiresAt = Date.now() + ttlSeconds * 1000;
    return NextResponse.json({ access_token, expires_at: expiresAt });
  } finally {
    if (gotLock) {
      await storage.del(REDIS_KEYS.refreshLock);
    }
  }
}
