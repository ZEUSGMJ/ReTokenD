const SESSION_EXEMPT_PATHS = new Set(["/api/token", "/api/check"]);

export function isSessionExemptPath(pathname: string): boolean {
  return SESSION_EXEMPT_PATHS.has(pathname);
}
