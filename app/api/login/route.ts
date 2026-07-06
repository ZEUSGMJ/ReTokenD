import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  OAUTH_STATE_COOKIE_NAME,
  OAUTH_STATE_MAX_AGE_SECONDS,
  createOAuthStateCookieValue,
} from "@/lib/session";
import { buildAuthorizeUrl, getConfiguredScopes } from "@/lib/spotify";
import { DEFAULT_PROFILE, isValidProfileId } from "@/lib/keys";
import { getSessionSecret } from "@/lib/auth";
import { isSessionCurrent } from "@/lib/session-server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  // proxy checks signature + age; the generation check (server-side revocation) runs here
  if (!(await isSessionCurrent())) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const profile = request.nextUrl.searchParams.get("profile") ?? DEFAULT_PROFILE;
  if (!isValidProfileId(profile)) {
    return NextResponse.json({ error: "invalid_profile" }, { status: 400 });
  }

  const sessionSecret = getSessionSecret();
  const state = crypto.randomUUID();

  const cookieValue = await createOAuthStateCookieValue(state, profile, sessionSecret);
  const cookieStore = await cookies();
  cookieStore.set(OAUTH_STATE_COOKIE_NAME, cookieValue, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: OAUTH_STATE_MAX_AGE_SECONDS,
  });

  const scopes = await getConfiguredScopes(profile);
  const authorizeUrl = await buildAuthorizeUrl(state, scopes, profile);
  return NextResponse.redirect(authorizeUrl);
}
