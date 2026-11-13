import type { ComponentType } from "react";
import {
  Bell,
  Clock,
  Lock,
  LockKeyhole,
  Server,
  Users,
  type LucideProps,
} from "lucide-react";

export const GITHUB_URL = "https://github.com/ZEUSGMJ/ReTokenD";

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3001");

export const NAV_LINKS = [
  { href: "#features", label: "Features" },
  { href: "#how", label: "How it works" },
  { href: "#setup", label: "Setup" },
  { href: "#api", label: "API" },
];

export const FEATURES: Array<{
  name: string;
  blurb: string;
  icon: ComponentType<LucideProps>;
}> = [
  {
    name: "Self-hosted",
    blurb:
      "Run it with Docker and Redis, or deploy it to Vercel with Upstash. It also runs anywhere that can run its Docker image and connect to Redis.",
    icon: Server,
  },
  {
    name: "Multi-profile",
    blurb:
      "One instance can hold tokens for several Spotify accounts, each with its own scopes and app credentials.",
    icon: Users,
  },
  {
    name: "Refresh tokens stay put",
    blurb:
      "The API only returns short-lived access tokens. The refresh token itself never leaves the server.",
    icon: Lock,
  },
  {
    name: "Expiry countdown",
    blurb:
      "Each profile shows the time left in its six-month window, so you can reauthorize before it expires.",
    icon: Clock,
  },
  {
    name: "Discord alerts",
    blurb:
      "Optional webhook messages when a token gets close to expiry or a profile needs reauthorizing.",
    icon: Bell,
  },
  {
    name: "Password-gated",
    blurb:
      "The dashboard sits behind a password with rate-limited logins, and the app is hidden from search engines.",
    icon: LockKeyhole,
  },
];

export const STEPS: Array<[string, string, string]> = [
  ["01", "Authorize once", "Log in to the dashboard and connect a Spotify account."],
  [
    "02",
    "Point your projects at it",
    "Replace the token stored in each project’s env with an authenticated GET request.",
  ],
  [
    "03",
    "Reauthorize when needed",
    "When the six months are up, reauthorize from the dashboard. Each project gets a working token on its next request.",
  ],
];
