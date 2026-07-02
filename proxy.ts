import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, isValidSessionCookie } from "@/lib/session";

// Next 16 middleware ("proxy"). Edge runtime — Web Crypto only.
// /api/token and /api/check are excluded by the matcher; they have their own bearer auth.
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
