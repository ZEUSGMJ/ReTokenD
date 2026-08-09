import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { storage } from "@/lib/storage";
import { keysFor, type ProfileKeys } from "@/lib/keys";
import { OAUTH_STATE_COOKIE_NAME, verifyOAuthStateCookie } from "@/lib/session";
import { exchangeCodeForTokens, fetchSpotifyProfile } from "@/lib/spotify";
import { registerProfile, clearNotificationFlags } from "@/lib/profiles";
import { getSessionSecret } from "@/lib/auth";
import { isSessionCurrent } from "@/lib/session-server";

export const runtime = "nodejs";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function errorPage(message: string) {
  return new NextResponse(
    `<!doctype html><html><body style="font-family:sans-serif;padding:2rem">
      <h1>Reauthorization failed</h1>
      <p>${escapeHtml(message)}</p>
      <p><a href="/">Back to dashboard</a></p>
    </body></html>`,
    { status: 400, headers: { "Content-Type": "text/html" } }
  );
}

async function persistAuthorization(
  profile: string,
  keys: ProfileKeys,
  refreshToken: string,
  issuedAt: string
) {
  // issued_at must never advance unless its corresponding refresh token is durable.
  await storage.set(keys.refreshToken, refreshToken);
  await storage.set(keys.refreshTokenIssuedAt, issuedAt);
  await Promise.all([
    storage.del(keys.accessToken),
    storage.del(keys.reauthRequired),
    clearNotificationFlags(profile),
  ]);
}

export async function GET(request: NextRequest) {
  // proxy checks signature + age; the generation check (server-side revocation) runs here
  if (!(await isSessionCurrent())) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const errorParam = searchParams.get("error");

  if (errorParam) {
    return errorPage(`Spotify returned an error: ${errorParam}`);
  }

  if (!code || !state) {
    return errorPage("Missing code or state parameter.");
  }

  const sessionSecret = getSessionSecret();
  const cookieStore = await cookies();
  const stateCookie = cookieStore.get(OAUTH_STATE_COOKIE_NAME)?.value;

  const stateResult = await verifyOAuthStateCookie(stateCookie, state, sessionSecret);
  if (!stateResult) {
    return errorPage("The OAuth state is invalid or has expired. Try reauthorizing.");
  }

  const { profile } = stateResult;

  try {
    const tokens = await exchangeCodeForTokens(code, profile);

    // never reset issued_at without a refresh token to store
    if (typeof tokens.refresh_token !== "string" || tokens.refresh_token.length === 0) {
      console.error("OAuth callback: Spotify returned no refresh_token", { profile });
      return errorPage("Spotify did not return a refresh token. Try reauthorizing.");
    }

    const keys = keysFor(profile);
    const nowIso = new Date().toISOString();

    await persistAuthorization(profile, keys, tokens.refresh_token, nowIso);

    const account = await fetchSpotifyProfile(tokens.access_token);
    if (account) {
      const ops: Promise<unknown>[] = [storage.set(keys.accountId, account.id)];
      if (account.display_name) ops.push(storage.set(keys.displayName, account.display_name));
      await Promise.all(ops);
    }

    await registerProfile(profile);

    const response = NextResponse.redirect(new URL("/", request.url));
    response.cookies.delete(OAUTH_STATE_COOKIE_NAME);
    return response;
  } catch (err) {
    console.error("OAuth callback failed", err);
    return errorPage("ReTokenD could not exchange the authorization code. Check the server logs.");
  }
}
