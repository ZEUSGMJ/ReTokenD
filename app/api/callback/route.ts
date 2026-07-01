import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { redis } from "@/lib/redis";
import { REDIS_KEYS, NOTIFY_THRESHOLDS_DAYS } from "@/lib/keys";
import { OAUTH_STATE_COOKIE_NAME, verifyOAuthStateCookie } from "@/lib/session";
import { exchangeCodeForTokens } from "@/lib/spotify";

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
      <h1>Re-authorization failed</h1>
      <p>${escapeHtml(message)}</p>
      <p><a href="/">Back to dashboard</a></p>
    </body></html>`,
    { status: 400, headers: { "Content-Type": "text/html" } }
  );
}

export async function GET(request: NextRequest) {
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

  const sessionSecret = process.env.SESSION_SECRET ?? "";
  const cookieStore = await cookies();
  const stateCookie = cookieStore.get(OAUTH_STATE_COOKIE_NAME)?.value;

  const stateValid = await verifyOAuthStateCookie(stateCookie, state, sessionSecret);
  if (!stateValid) {
    return errorPage("Invalid or expired OAuth state. Please try re-authorizing again.");
  }

  try {
    const tokens = await exchangeCodeForTokens(code);

    const nowIso = new Date().toISOString();
    const notifiedKeys = NOTIFY_THRESHOLDS_DAYS.map((d) => REDIS_KEYS.notified(d));

    await Promise.all([
      redis.set(REDIS_KEYS.refreshToken, tokens.refresh_token),
      redis.set(REDIS_KEYS.refreshTokenIssuedAt, nowIso),
      redis.del(REDIS_KEYS.accessToken),
      redis.del(REDIS_KEYS.reauthRequired),
      ...(notifiedKeys.length > 0 ? [redis.del(...notifiedKeys)] : []),
    ]);

    const response = NextResponse.redirect(new URL("/", request.url));
    response.cookies.delete(OAUTH_STATE_COOKIE_NAME);
    return response;
  } catch (err) {
    console.error("OAuth callback failed", err);
    return errorPage("Could not exchange the authorization code for tokens. Check server logs.");
  }
}
