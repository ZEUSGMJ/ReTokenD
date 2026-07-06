import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, isValidSessionCookie } from "@/lib/session";

// Next 16 middleware ("proxy"). Edge runtime — Web Crypto only.
// Fail-closed: the matcher protects everything except the bearer-authed APIs
// (/api/token, /api/check) and static assets, so new routes are gated by default.
// Signature + age only here; the server-side generation check runs Node-side.

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // /login must render without a session (and /robots.txt if it ever slips through)
  if (pathname !== "/login" && pathname !== "/robots.txt") {
    const sessionSecret = process.env.SESSION_SECRET;
    const cookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    const valid = sessionSecret
      ? await isValidSessionCookie(cookie, sessionSecret)
      : false;

    if (!valid) {
      const loginUrl = new URL("/login", request.url);
      const response = NextResponse.redirect(loginUrl);
      response.headers.set("X-Robots-Tag", "noindex, nofollow");
      return response;
    }
  }

  const response = NextResponse.next();
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

export const config = {
  matcher: [
    "/((?!api/token|api/check|_next/static|_next/image|favicon.ico|robots.txt|.*\\.(?:svg|png|ico)).*)",
  ],
};
