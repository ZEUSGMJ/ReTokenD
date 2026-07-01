import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/lib/storage";
import { DEFAULT_PROFILE, isValidProfileId, keysFor, type ProfileKeys } from "@/lib/keys";
import { refreshAccessToken } from "@/lib/spotify";
import { isProfileEnabled, profileExists } from "@/lib/profiles";
import { bearerMatches } from "@/lib/auth";

export const runtime = "nodejs";

// Read the cached access token and compute expires_at from its remaining TTL.
async function readCachedAccessToken(
  keys: ProfileKeys
): Promise<{ access_token: string; expires_at: number } | null> {
  const cachedAccessToken = await storage.get<string>(keys.accessToken);
  if (!cachedAccessToken) return null;
  const ttl = await storage.ttl(keys.accessToken);
  const expiresAt = Date.now() + Math.max(ttl, 0) * 1000;
  return { access_token: cachedAccessToken, expires_at: expiresAt };
}

export async function GET(request: NextRequest) {
  const brokerSecret = process.env.BROKER_SECRET ?? "";
  const authHeader = request.headers.get("authorization") ?? "";

  if (!bearerMatches(authHeader, brokerSecret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const profile = request.nextUrl.searchParams.get("profile") ?? DEFAULT_PROFILE;
  if (!isValidProfileId(profile)) {
    return NextResponse.json({ error: "invalid_profile" }, { status: 400 });
  }
  if (!(await profileExists(profile))) {
    return NextResponse.json({ error: "unknown_profile" }, { status: 404 });
  }
  if (!(await isProfileEnabled(profile))) {
    return NextResponse.json({ error: "profile_disabled" }, { status: 403 });
  }

  const keys = keysFor(profile);

  // Serve cached access token if present.
  const cached = await readCachedAccessToken(keys);
  if (cached) {
    return NextResponse.json({ ...cached, profile });
  }

  const refreshToken = await storage.get<string>(keys.refreshToken);
  if (!refreshToken) {
    return NextResponse.json({ error: "reauth_required", profile }, { status: 409 });
  }

  // Single-flight: only one request should hit Spotify's refresh endpoint at
  // a time. Losers poll the access-token cache briefly, then fall through to
  // a normal refresh as a safety valve if the winner doesn't finish in time.
  const gotLock = await storage.acquireLock(keys.refreshLock, 10);

  if (!gotLock) {
    for (let i = 0; i < 10; i++) {
      await new Promise((r) => setTimeout(r, 200));
      const cachedWhilePolling = await readCachedAccessToken(keys);
      if (cachedWhilePolling) {
        return NextResponse.json({ ...cachedWhilePolling, profile });
      }
    }
    // Timed out waiting for the lock holder — fall through and refresh anyway.
  }

  try {
    const result = await refreshAccessToken(refreshToken, profile);

    if (!result.ok) {
      if (result.invalidGrant) {
        // Do NOT retry. Flag for re-auth.
        await storage.set(keys.reauthRequired, "1");
        return NextResponse.json({ error: "reauth_required", profile }, { status: 409 });
      }
      console.error("Spotify refresh failed", result.error);
      return NextResponse.json({ error: "spotify_error" }, { status: 502 });
    }

    const { access_token, expires_in, refresh_token: newRefreshToken } = result.data;
    const ttlSeconds = Math.max(expires_in - 60, 60);
    const nowIso = new Date().toISOString();

    const ops: Promise<unknown>[] = [
      storage.setWithTTL(keys.accessToken, access_token, ttlSeconds),
      storage.set(keys.lastRefresh, nowIso),
    ];

    // If Spotify rotated the refresh token, store the new one — but NEVER
    // touch issued_at here; that is only set on full re-auth in /api/callback.
    if (newRefreshToken && newRefreshToken !== refreshToken) {
      ops.push(storage.set(keys.refreshToken, newRefreshToken));
    }

    await Promise.all(ops);

    const expiresAt = Date.now() + ttlSeconds * 1000;
    return NextResponse.json({ access_token, expires_at: expiresAt, profile });
  } finally {
    if (gotLock) {
      await storage.del(keys.refreshLock);
    }
  }
}
