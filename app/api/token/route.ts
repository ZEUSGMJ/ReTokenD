import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/lib/storage";
import { DEFAULT_PROFILE, isValidProfileId, keysFor, type ProfileKeys } from "@/lib/keys";
import { refreshAccessToken } from "@/lib/spotify";
import { isProfileEnabled, listProfiles } from "@/lib/profiles";
import { bearerMatches } from "@/lib/auth";

export const runtime = "nodejs";

interface CachedToken {
  access_token: string;
  expires_at: number;
}

// single-key cache: {access_token, expires_at}. A non-object (legacy string) or
// an expired value is treated as a miss — no TTL round trip, expires_at is authoritative.
async function readCachedAccessToken(keys: ProfileKeys): Promise<CachedToken | null> {
  const cached = await storage.get<CachedToken>(keys.accessToken);
  if (!cached || typeof cached !== "object") return null;
  if (typeof cached.access_token !== "string" || typeof cached.expires_at !== "number") {
    return null;
  }
  if (cached.expires_at <= Date.now()) return null;
  return cached;
}

export async function GET(request: NextRequest) {
  const tokenSecret = process.env.RETOKEND_SECRET ?? "";
  const authHeader = request.headers.get("authorization") ?? "";

  if (!bearerMatches(authHeader, tokenSecret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const profile = request.nextUrl.searchParams.get("profile") ?? DEFAULT_PROFILE;
  if (!isValidProfileId(profile)) {
    return NextResponse.json({ error: "invalid_profile" }, { status: 400 });
  }

  const keys = keysFor(profile);

  // parallelize the independent hot-path reads; branch below preserves 400→404→403 ordering
  const [registry, enabled, cached] = await Promise.all([
    listProfiles(),
    isProfileEnabled(profile),
    readCachedAccessToken(keys),
  ]);

  if (!registry.includes(profile)) {
    return NextResponse.json({ error: "unknown_profile" }, { status: 404 });
  }
  if (!enabled) {
    return NextResponse.json({ error: "profile_disabled" }, { status: 403 });
  }

  if (cached) {
    return NextResponse.json({ ...cached, profile });
  }

  const [refreshToken, reauthRequired] = await Promise.all([
    storage.get<string>(keys.refreshToken),
    storage.get<string>(keys.reauthRequired),
  ]);

  if (!refreshToken) {
    return NextResponse.json({ error: "reauth_required", profile }, { status: 409 });
  }
  // no refresh retries after invalid_grant until re-auth clears the flag (spec)
  if (reauthRequired) {
    return NextResponse.json({ error: "reauth_required", profile }, { status: 409 });
  }

  // single-flight refresh; losers poll the cache, then refresh anyway as a fallback
  const gotLock = await storage.acquireLock(keys.refreshLock, 10);

  let effectiveRefreshToken = refreshToken;

  if (!gotLock) {
    for (let i = 0; i < 4; i++) {
      await new Promise((r) => setTimeout(r, 500));
      const cachedWhilePolling = await readCachedAccessToken(keys);
      if (cachedWhilePolling) {
        return NextResponse.json({ ...cachedWhilePolling, profile });
      }
    }
    // winner stalled: re-read state before the fallback refresh so we don't act on stale data
    const [freshRefresh, freshReauth] = await Promise.all([
      storage.get<string>(keys.refreshToken),
      storage.get<string>(keys.reauthRequired),
    ]);
    if (freshReauth) {
      return NextResponse.json({ error: "reauth_required", profile }, { status: 409 });
    }
    if (!freshRefresh) {
      return NextResponse.json({ error: "reauth_required", profile }, { status: 409 });
    }
    effectiveRefreshToken = freshRefresh;
  }

  try {
    const result = await refreshAccessToken(effectiveRefreshToken, profile);

    if (!result.ok) {
      if (result.invalidGrant) {
        await storage.set(keys.reauthRequired, "1");
        return NextResponse.json({ error: "reauth_required", profile }, { status: 409 });
      }
      console.error("Spotify refresh failed", result.error);
      return NextResponse.json({ error: "spotify_error" }, { status: 502 });
    }

    const { access_token, expires_in, refresh_token: newRefreshToken } = result.data;
    const ttlSeconds = Math.max(expires_in - 60, 60);
    const expiresAt = Date.now() + ttlSeconds * 1000;
    const nowIso = new Date().toISOString();

    const ops: Promise<unknown>[] = [
      storage.setWithTTL(keys.accessToken, { access_token, expires_at: expiresAt }, ttlSeconds),
      storage.set(keys.lastRefresh, nowIso),
      storage.del(keys.reauthRequired),
    ];

    // rotated refresh token; only the lock winner may write it (a loser must not
    // clobber the winner's rotation). issued_at is only ever set in /api/callback.
    if (gotLock && newRefreshToken && newRefreshToken !== effectiveRefreshToken) {
      ops.push(storage.set(keys.refreshToken, newRefreshToken));
    }

    await Promise.all(ops);

    return NextResponse.json({ access_token, expires_at: expiresAt, profile });
  } finally {
    if (gotLock) {
      await storage.del(keys.refreshLock);
    }
  }
}
