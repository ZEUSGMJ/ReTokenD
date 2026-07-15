import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, isValidSessionCookie } from "@/lib/session";
import { isSessionExemptPath } from "@/lib/proxy-paths";

// Exact bearer routes bypass the session check; similarly prefixed routes do not.
// Signature + age only here; the storage-backed generation check runs in routes.

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isSessionExemptPath(pathname)) {
    const response = NextResponse.next();
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
    return response;
  }

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
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|.*\\.(?:svg|png|ico)).*)",
  ],
};
