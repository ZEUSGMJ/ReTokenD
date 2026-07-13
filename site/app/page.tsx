import type { ReactNode } from "react";
import {
  Bell,
  ChevronRight,
  Clock,
  Lock,
  LockKeyhole,
  Server,
  Users,
  type LucideIcon,
} from "lucide-react";

const GITHUB_URL = "https://github.com/ZEUSGMJ/ReTokenD";

const FEATURES: Array<{ icon: LucideIcon; name: string; blurb: string }> = [
  {
    icon: Server,
    name: "Self-hosted",
    blurb: "Runs on Docker with Redis, or on Vercel with Upstash. Coolify, Railway, Fly.io or a plain VPS work too.",
  },
  {
    icon: Users,
    name: "Multi-profile",
    blurb: "One instance can hold tokens for several Spotify accounts, each with its own scopes and app credentials.",
  },
  {
    icon: Lock,
    name: "Refresh tokens stay put",
    blurb: "The API only returns short-lived access tokens. The refresh token itself never leaves the server.",
  },
  {
    icon: Clock,
    name: "Expiry countdown",
    blurb: "Each profile shows how much of its six-month window is left, so an expiry doesn't come as a surprise.",
  },
  {
    icon: Bell,
    name: "Discord alerts",
    blurb: "Optional webhook messages when a token gets close to expiry or a profile needs re-authorizing.",
  },
  {
    icon: LockKeyhole,
    name: "Password-gated",
    blurb: "The dashboard sits behind a password with rate-limited logins, and the app is hidden from search engines.",
  },
];

const TICKER = [
  "SELF-HOSTED",
  "OPEN SOURCE · GPL-3.0",
  "DOCKER + REDIS",
  "VERCEL + UPSTASH",
  "MULTI-PROFILE",
  "ONE-CLICK RE-AUTH",
  "DISCORD ALERTS",
];

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="font-mono text-xs uppercase tracking-[0.3em] text-accent-bright">
      {children}
    </p>
  );
}

function CodeBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="glass overflow-hidden rounded-2xl">
      <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-3">
        <span className="font-mono text-xs text-muted">{title}</span>
        <span className="size-1.5 rounded-full bg-accent shadow-[0_0_8px_rgba(16,185,129,0.9)]" />
      </div>
      <div className="overflow-x-auto p-5 font-mono text-[13px] leading-relaxed">
        {children}
      </div>
    </div>
  );
}

function FlowNode({
  label,
  title,
  children,
}: {
  label: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="glass flex flex-col gap-3 rounded-2xl p-6">
      <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-faint">
        {label}
      </span>
      <span className="text-lg font-semibold tracking-tight">{title}</span>
      <div className="text-sm leading-relaxed text-muted">{children}</div>
    </div>
  );
}

function FlowArrow({ top, bottom }: { top: string; bottom?: string }) {
  return (
    <div className="flex items-center gap-2 self-center px-1 py-2 lg:flex-col lg:gap-1 lg:py-0">
      <span className="font-mono text-[10px] text-accent-bright">{top}</span>
      <span className="hidden h-px w-16 bg-linear-to-r from-accent/70 to-accent/10 lg:block" />
      <span className="text-accent lg:hidden">↓</span>
      {bottom ? (
        <span className="font-mono text-[10px] text-faint">{bottom}</span>
      ) : null}
    </div>
  );
}

export default function Home() {
  return (
    <div className="relative">
      {/* ambient background */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-225 overflow-hidden">
        <div className="bg-grid absolute inset-0" />
        <div className="absolute -top-48 left-1/2 h-130 w-205 -translate-x-1/2 rounded-full bg-emerald-500/20 blur-[150px]" />
        <div className="absolute top-40 -left-40 h-95 w-95 rounded-full bg-teal-500/10 blur-[120px]" />
        <div className="absolute top-64 -right-40 h-95 w-95 rounded-full bg-cyan-500/10 blur-[120px]" />
      </div>

      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/6 bg-background/70 backdrop-blur-xl">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <a href="#top" className="text-[17px] font-semibold tracking-tight">
            ReToken<span className="text-gradient">D</span>
          </a>
          <div className="flex items-center gap-6 text-sm text-muted">
            <a href="#features" className="hidden transition-colors hover:text-foreground md:inline">
              Features
            </a>
            <a href="#how" className="hidden transition-colors hover:text-foreground md:inline">
              How it works
            </a>
            <a href="#setup" className="hidden transition-colors hover:text-foreground sm:inline">
              Setup
            </a>
            <a href="#api" className="hidden transition-colors hover:text-foreground sm:inline">
              API
            </a>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-white/15 px-4 py-1.5 text-foreground transition-colors hover:border-emerald-400/60 hover:text-accent-bright"
            >
              GitHub ↗
            </a>
          </div>
        </nav>
      </header>

      <main id="top" className="mx-auto max-w-6xl px-5 pt-36">
        {/* hero */}
        <section className="grid items-center gap-14 pb-20 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="flex flex-col items-start gap-7">
            <span className="glass inline-flex items-center gap-2.5 rounded-full px-4 py-1.5 font-mono text-xs text-muted">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
              </span>
              SELF-HOSTED · OPEN SOURCE
            </span>
            <h1 className="text-5xl font-semibold leading-[1.05] tracking-tighter sm:text-6xl">
              One place for your
              <br />
              <span className="text-gradient">Spotify refresh tokens.</span>
            </h1>
            <p className="max-w-md text-lg leading-relaxed text-muted">
              ReTokenD is a small service I built after getting tired of
              pasting new Spotify tokens into every project that used them. It
              stores the refresh tokens, hands out short-lived access tokens
              through one endpoint, and re-authorizes with a single click.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <a
                href="#setup"
                className="rounded-full bg-linear-to-r from-emerald-400 to-teal-400 px-7 py-3 text-sm font-semibold text-black shadow-[0_0_36px_rgba(16,185,129,0.35)] transition-shadow hover:shadow-[0_0_52px_rgba(16,185,129,0.55)]"
              >
                How to run it
              </a>
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-white/15 px-7 py-3 text-sm font-semibold text-foreground transition-colors hover:border-white/40"
              >
                Source on GitHub
              </a>
            </div>
          </div>

          {/* mock profile card, styled like the dashboard's ProfileCard */}
          <div className="relative mx-auto w-full max-w-md" aria-hidden>
            <div className="glass absolute inset-0 translate-x-5 translate-y-6 rotate-3 rounded-xl opacity-50" />
            <div className="relative flex flex-col gap-4 rounded-xl bg-neutral-900 p-4 text-sm text-neutral-50 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)] ring-1 ring-white/10">
              <div className="flex items-center justify-between gap-3">
                <span className="flex flex-col">
                  <span className="font-mono text-base font-medium">default</span>
                  <span className="text-xs text-neutral-400">ZEUSGMJ</span>
                </span>
                <span className="rounded-md bg-green-600 px-2 py-0.5 text-xs font-medium text-white">
                  Valid
                </span>
              </div>
              <div className="flex flex-col items-center gap-2 py-2">
                <span className="font-mono text-3xl font-semibold tabular-nums">
                  142d 07h 33m 12s
                </span>
                <span className="text-sm text-neutral-400">
                  until refresh token expires
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs uppercase text-neutral-400">Issued at</div>
                  <div>Jun 1, 2026, 11:24 AM</div>
                </div>
                <div>
                  <div className="text-xs uppercase text-neutral-400">Expires at</div>
                  <div>Dec 1, 2026, 11:24 AM</div>
                </div>
                <div>
                  <div className="text-xs uppercase text-neutral-400">Last refresh</div>
                  <div>Jul 12, 2026, 6:47 PM</div>
                </div>
                <div>
                  <div className="text-xs uppercase text-neutral-400">Days left</div>
                  <div>142</div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-md bg-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-900">
                  Re-authorize
                </span>
                <span className="rounded-md border border-white/15 px-3 py-1.5 text-xs font-medium">
                  Test Notification
                </span>
                <span className="rounded-md border border-white/15 px-3 py-1.5 text-xs font-medium">
                  Disable
                </span>
              </div>
              <div className="flex items-center gap-2 rounded-md border border-white/10 px-3 py-2 font-medium">
                <ChevronRight className="size-4 text-neutral-400" />
                Spotify app (shared)
              </div>
              <div className="flex items-center gap-2 rounded-md border border-white/10 px-3 py-2 font-medium">
                <ChevronRight className="size-4 text-neutral-400" />
                Scopes
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ticker */}
      <div className="border-y border-white/6 py-4">
        <div className="flex w-max animate-marquee gap-10 whitespace-nowrap font-mono text-xs tracking-[0.25em] text-faint">
          {[...TICKER, ...TICKER].map((item, i) => (
            <span key={i} className="flex items-center gap-10">
              {item} <span className="text-accent">✦</span>
            </span>
          ))}
        </div>
      </div>

      <main className="mx-auto flex max-w-6xl flex-col gap-32 px-5 pb-28 pt-24">
        {/* the problem / stats */}
        <section className="flex flex-col gap-12">
          <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 text-center">
            <SectionLabel>The problem</SectionLabel>
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Why this exists
            </h2>
            <p className="leading-relaxed text-muted">
              Starting July 20, 2026, Spotify{" "}
              <a
                href="https://developer.spotify.com/blog/2026-06-18-refresh-token-expiration"
                target="_blank"
                rel="noreferrer"
                className="text-accent-bright underline decoration-emerald-400/40 underline-offset-4 transition-colors hover:decoration-emerald-400"
              >
                refresh tokens expire six months after authorization
              </a>
              . Refreshing an access token doesn&apos;t extend that window
              either. I have several projects using the same account, so every
              expiry meant re-authorizing and then updating the token in each
              project&apos;s env, one by one. That got old fast.
            </p>
          </div>
          <div className="glass grid grid-cols-2 divide-white/[0.07] rounded-2xl max-lg:gap-y-8 max-lg:p-8 lg:grid-cols-4 lg:divide-x lg:p-10">
            {[
              ["6 mo", "refresh token lifetime"],
              ["1", "click to re-authorize"],
              ["0", "refresh tokens ever returned"],
              ["409", "response while re-auth is pending"],
            ].map(([num, label]) => (
              <div key={label} className="flex flex-col items-center gap-1.5 text-center">
                <span className="text-gradient font-mono text-3xl font-semibold sm:text-4xl">
                  {num}
                </span>
                <span className="text-sm text-muted">{label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* features */}
        <section id="features" className="flex flex-col gap-12">
          <div className="flex flex-col gap-4">
            <SectionLabel>Features</SectionLabel>
            <h2 className="max-w-lg text-3xl font-semibold tracking-tight sm:text-4xl">
              What it does
            </h2>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: FeatureIcon, name, blurb }) => (
              <div
                key={name}
                className="glass group flex flex-col gap-4 rounded-2xl p-6 transition-colors hover:border-emerald-400/30"
              >
                <span className="flex size-10 items-center justify-center rounded-xl border border-emerald-400/25 bg-emerald-400/10 text-accent-bright">
                  <FeatureIcon className="size-5" strokeWidth={1.6} aria-hidden />
                </span>
                <span className="font-semibold tracking-tight">{name}</span>
                <p className="text-sm leading-relaxed text-muted">{blurb}</p>
              </div>
            ))}
          </div>
        </section>

        {/* how it works */}
        <section id="how" className="flex flex-col gap-12">
          <div className="flex flex-col gap-4">
            <SectionLabel>How it works</SectionLabel>
            <h2 className="max-w-lg text-3xl font-semibold tracking-tight sm:text-4xl">
              One service between your projects and Spotify
            </h2>
          </div>
          <div className="flex flex-col gap-2 lg:grid lg:grid-cols-[1fr_auto_1.15fr_auto_0.8fr] lg:items-stretch lg:gap-0">
            <FlowNode label="consumers" title="Your projects">
              Bots, dashboards, widgets, anything that talks to the Spotify
              API. Each one calls{" "}
              <code className="text-accent-bright">GET /api/token</code> with a
              bearer secret instead of carrying its own token.
            </FlowNode>
            <FlowArrow top="access token" bottom="short-lived" />
            <FlowNode label="this service" title="ReTokenD">
              Keeps the refresh tokens in Redis, fetches fresh access tokens
              when asked, and tracks the six-month countdown per profile.{" "}
              <span className="text-foreground">
                The refresh tokens never leave this box.
              </span>
            </FlowNode>
            <FlowArrow top="token refresh" bottom="oauth" />
            <FlowNode label="upstream" title="Spotify">
              Standard OAuth. When the window closes, re-authorizing from the
              dashboard takes one click, and every project gets working tokens
              again on its next request.
            </FlowNode>
          </div>
          <ol className="grid gap-8 sm:grid-cols-3">
            {[
              ["01", "Authorize once", "Log in to the dashboard and connect a Spotify account."],
              ["02", "Point your projects at it", "Replace the token in each project's env with one authenticated GET request."],
              ["03", "Re-authorize when asked", "When the six months are up, it's one click in the dashboard, and every project picks the change up on its own."],
            ].map(([num, title, body]) => (
              <li key={num} className="flex flex-col gap-2">
                <span className="text-gradient font-mono text-2xl font-semibold">{num}</span>
                <span className="font-semibold tracking-tight">{title}</span>
                <span className="text-sm leading-relaxed text-muted">{body}</span>
              </li>
            ))}
          </ol>
        </section>

        {/* setup */}
        <section id="setup" className="flex flex-col gap-12">
          <div className="flex flex-col gap-4">
            <SectionLabel>Setup</SectionLabel>
            <h2 className="max-w-lg text-3xl font-semibold tracking-tight sm:text-4xl">
              Running it
            </h2>
            <p className="max-w-2xl leading-relaxed text-muted">
              Create an app in the{" "}
              <a
                href="https://developer.spotify.com/"
                target="_blank"
                rel="noreferrer"
                className="text-accent-bright underline decoration-emerald-400/40 underline-offset-4 transition-colors hover:decoration-emerald-400"
              >
                Spotify Developer Dashboard
              </a>{" "}
              and register both redirect URIs. Every profile shares the same
              callback. Then pick whichever of the two setups fits.
            </p>
          </div>
          <CodeBlock title="spotify dashboard → redirect URIs">
            <div className="text-foreground">
              https://&lt;your-domain&gt;/api/callback
            </div>
            <div className="text-foreground">
              http://127.0.0.1:3000/api/callback
            </div>
            <div className="mt-2 text-faint">
              # spotify only allows plain http on the 127.0.0.1 loopback, not
              localhost
            </div>
          </CodeBlock>
          <div className="grid gap-5 lg:grid-cols-2">
            <CodeBlock title="option a: docker + redis">
              <div>
                <span className="text-accent-bright">$</span>{" "}
                <span className="text-foreground">git clone {GITHUB_URL}.git</span>
              </div>
              <div>
                <span className="text-accent-bright">$</span>{" "}
                <span className="text-foreground">cd ReTokenD</span>
              </div>
              <div>
                <span className="text-accent-bright">$</span>{" "}
                <span className="text-foreground">cp .env.example .env</span>{" "}
                <span className="text-faint"># fill in the vars below</span>
              </div>
              <div>
                <span className="text-accent-bright">$</span>{" "}
                <span className="text-foreground">docker compose up --build</span>
              </div>
              <div className="mt-2 text-faint">
                # app on :3000 + redis with a persistent volume.
                <br /># also runs on coolify, railway, fly.io, a VPS, …
              </div>
            </CodeBlock>
            <CodeBlock title="option b: vercel + upstash">
              <div className="text-muted">
                <span className="text-accent-bright">1.</span> import the repo
                on vercel
              </div>
              <div className="text-muted">
                <span className="text-accent-bright">2.</span> install the
                upstash integration (marketplace)
              </div>
              <div className="text-muted">
                <span className="text-accent-bright">3.</span> set the env vars
                below
              </div>
              <div className="text-muted">
                <span className="text-accent-bright">4.</span> deploy
              </div>
              <div className="mt-2 text-faint">
                # leave REDIS_URL unset, upstash is auto-detected.
                <br /># the daily /api/check cron is picked up automatically.
              </div>
            </CodeBlock>
          </div>
          <CodeBlock title=".env">
            <div>
              <span className="text-foreground">SPOTIFY_CLIENT_ID</span>
              <span className="text-faint">=…          # spotify app credentials</span>
            </div>
            <div>
              <span className="text-foreground">SPOTIFY_CLIENT_SECRET</span>
              <span className="text-faint">=…</span>
            </div>
            <div>
              <span className="text-foreground">ADMIN_PASSWORD</span>
              <span className="text-faint">=…             # dashboard login</span>
            </div>
            <div>
              <span className="text-foreground">SESSION_SECRET</span>
              <span className="text-faint">=…             # session signing key</span>
            </div>
            <div>
              <span className="text-foreground">RETOKEND_SECRET</span>
              <span className="text-faint">=…            # bearer for /api/token</span>
            </div>
            <div>
              <span className="text-foreground">CRON_SECRET</span>
              <span className="text-faint">=…                # bearer for /api/check</span>
            </div>
            <div>
              <span className="text-foreground">BASE_URL</span>
              <span className="text-faint">=…                   # public URL for the oauth callback</span>
            </div>
            <div>
              <span className="text-foreground">REDIS_URL</span>
              <span className="text-faint">=…                  # docker / self-host storage</span>
            </div>
            <div className="mt-2 text-faint">
              # on vercel: KV_REST_API_URL + KV_REST_API_TOKEN instead of
              REDIS_URL
            </div>
          </CodeBlock>
        </section>

        {/* api */}
        <section id="api" className="flex flex-col gap-12">
          <div className="flex flex-col gap-4">
            <SectionLabel>The API</SectionLabel>
            <h2 className="max-w-lg text-3xl font-semibold tracking-tight sm:text-4xl">
              The token endpoint
            </h2>
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <CodeBlock title="request">
              <div>
                <span className="text-accent-bright">$</span>{" "}
                <span className="text-foreground">
                  curl -H &quot;Authorization: Bearer $RETOKEND_SECRET&quot; \
                </span>
              </div>
              <div className="pl-6 text-foreground">
                &quot;https://&lt;retokend&gt;/api/token?profile=portfolio&quot;
              </div>
              <div className="mt-4 font-mono text-xs text-faint">
                401 bad bearer · 403 profile disabled · 404 unknown profile ·
                409 re-auth required
              </div>
            </CodeBlock>
            <CodeBlock title="response · 200">
              <div className="text-muted">{"{"}</div>
              <div className="pl-4 text-muted">
                <span className="text-accent-bright">&quot;access_token&quot;</span>:
                &quot;BQDe3f…&quot;,
              </div>
              <div className="pl-4 text-muted">
                <span className="text-accent-bright">&quot;expires_at&quot;</span>:
                1750000000000,
              </div>
              <div className="pl-4 text-muted">
                <span className="text-accent-bright">&quot;profile&quot;</span>:
                &quot;portfolio&quot;
              </div>
              <div className="text-muted">{"}"}</div>
            </CodeBlock>
          </div>
          <div className="glass flex items-center gap-4 rounded-2xl border-emerald-400/20 px-6 py-5">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-emerald-400/25 bg-emerald-400/10 text-accent-bright">
              <Lock className="size-5" strokeWidth={1.6} aria-hidden />
            </span>
            <p className="text-sm leading-relaxed text-muted">
              <span className="font-semibold text-foreground">
                The refresh token is never returned.
              </span>{" "}
              It stays on the server. Consumers only ever see short-lived
              access tokens.
            </p>
          </div>
        </section>

        {/* cta */}
        <section className="relative overflow-hidden rounded-3xl border border-emerald-400/20 px-8 py-16 text-center">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_60%_120%_at_50%_100%,rgba(16,185,129,0.22),transparent)]"
          />
          <div className="mx-auto flex max-w-xl flex-col items-center gap-6">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              That&apos;s about <span className="text-gradient">it.</span>
            </h2>
            <p className="leading-relaxed text-muted">
              ReTokenD is GPL-3.0 and was built for my own projects. If it
              solves the same problem for you, the code and full docs are on
              GitHub.
            </p>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer"
              className="rounded-full bg-linear-to-r from-emerald-400 to-teal-400 px-8 py-3.5 text-sm font-semibold text-black shadow-[0_0_36px_rgba(16,185,129,0.35)] transition-shadow hover:shadow-[0_0_52px_rgba(16,185,129,0.55)]"
            >
              ReTokenD on GitHub ↗
            </a>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/6">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-8 text-sm text-faint">
          <span className="font-semibold tracking-tight text-muted">
            ReToken<span className="text-gradient">D</span>
          </span>
          <span>GPL-3.0 · not affiliated with Spotify</span>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            className="transition-colors hover:text-accent-bright"
          >
            github.com/ZEUSGMJ/ReTokenD ↗
          </a>
        </div>
      </footer>
    </div>
  );
}
