import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, isValidSessionCookie } from "@/lib/session";

// Next.js 16 renamed the "middleware" convention to "proxy". This runs on the
// Edge runtime, so it uses Web Crypto (via lib/session) — not node:crypto.
//
// Routes that require the signed admin session cookie.
// Excluded by config.matcher below: /api/token (bearer-gated) and
// /api/check (cron-secret-gated) — those have their own auth.
const PROTECTED_PREFIXES = ["/api/login", "/api/callback"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected =
    pathname === "/" ||
    pathname === "/login" ||
    PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));

  if (isProtected && pathname !== "/login") {
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
  matcher: ["/", "/login", "/api/login", "/api/callback"],
};
