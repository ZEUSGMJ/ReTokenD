import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  OAUTH_STATE_COOKIE_NAME,
  OAUTH_STATE_MAX_AGE_SECONDS,
  createOAuthStateCookieValue,
} from "@/lib/session";
import { buildAuthorizeUrl, getConfiguredScopes } from "@/lib/spotify";

export const runtime = "nodejs";

export async function GET() {
  const sessionSecret = process.env.SESSION_SECRET ?? "";
  const state = crypto.randomUUID();

  const cookieValue = await createOAuthStateCookieValue(state, sessionSecret);
  const cookieStore = await cookies();
  cookieStore.set(OAUTH_STATE_COOKIE_NAME, cookieValue, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: OAUTH_STATE_MAX_AGE_SECONDS,
  });

  const scopes = await getConfiguredScopes();
  const authorizeUrl = buildAuthorizeUrl(state, scopes);
  return NextResponse.redirect(authorizeUrl);
}
