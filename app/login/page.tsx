import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  createSessionCookieValue,
} from "@/lib/session";
import { constantTimeEquals, getSessionSecret } from "@/lib/auth";
import { getSessionGeneration } from "@/lib/session-server";
import { storage } from "@/lib/storage";
import { Input } from "@/components/ui/input";

const LOGIN_ERROR_PARAM = "error";

// lockout applies even to correct passwords until the window expires
const LOGIN_MAX_FAILURES = 10;
const LOGIN_WINDOW_SECONDS = 15 * 60;
// global fallback so a spoofed X-Forwarded-For can't yield unlimited guesses
const LOGIN_GLOBAL_KEY = "login:fail:global";
const LOGIN_GLOBAL_MAX_FAILURES = 50;

async function clientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return h.get("x-real-ip") ?? "unknown";
}

async function login(formData: FormData) {
  "use server";

  const password = String(formData.get("password") ?? "");
  const adminPassword = process.env.ADMIN_PASSWORD ?? "";
  const sessionSecret = getSessionSecret();

  const failKey = `login:fail:${await clientIp()}`;
  const [perIp, global] = await Promise.all([
    storage.get<number>(failKey),
    storage.get<number>(LOGIN_GLOBAL_KEY),
  ]);

  if ((perIp ?? 0) >= LOGIN_MAX_FAILURES || (global ?? 0) >= LOGIN_GLOBAL_MAX_FAILURES) {
    redirect(`/login?${LOGIN_ERROR_PARAM}=1`);
  }

  const valid =
    adminPassword.length > 0 && constantTimeEquals(password, adminPassword);

  if (!valid) {
    // atomic INCR preserves the window (expiry set only when the key is new)
    await Promise.all([
      storage.incr(failKey, LOGIN_WINDOW_SECONDS),
      storage.incr(LOGIN_GLOBAL_KEY, LOGIN_WINDOW_SECONDS),
    ]);
    redirect(`/login?${LOGIN_ERROR_PARAM}=1`);
  }

  await storage.del(failKey);

  const generation = await getSessionGeneration();
  const cookieValue = await createSessionCookieValue(sessionSecret, generation);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, cookieValue, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  redirect("/");
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ [LOGIN_ERROR_PARAM]?: string }>;
}) {
  const { [LOGIN_ERROR_PARAM]: error } = await searchParams;

  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>ReTokenD</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={login} className="flex flex-col gap-3">
            <Input
              type="password"
              name="password"
              placeholder="Admin password"
              autoFocus
              required
            />
            {error && (
              <p className="text-sm text-destructive">Incorrect password.</p>
            )}
            <Button type="submit" className="w-full">
              Sign in
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
