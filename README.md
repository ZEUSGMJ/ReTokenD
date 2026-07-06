# ReTokenD

A self-hosted **Spotify OAuth token manager**. It owns your Spotify refresh
token(s), hands short-lived access tokens to your other projects, shows a live
countdown to each token's 6-month expiry, and lets you re-authorize with one
click — so a single re-auth heals every consumer at once instead of pasting a
new token into several project envs.

Run it on your own box with Docker + local Redis, or on Vercel with Upstash.
Manage one Spotify account or several, each as an independent **profile**.

> Not affiliated with Spotify. You bring your own Spotify Developer credentials.

## Features

- **Self-hostable** — Docker + local Redis, or Vercel + Upstash. Storage backend
  is pluggable and auto-selected from env.
- **Multiple Spotify profiles** — one ReTokenD instance, many independent authorizations
  (`default`, `portfolio`, `personal`, …), each with its own token, scopes,
  countdown, and optional dedicated Spotify app credentials.
- **Never leaks refresh tokens** — `/api/token` returns an access token only.
- **Expiry countdown + Discord alerts** — daily threshold checks (14/7/1 days)
  and immediate re-auth alerts.
- **Password-gated & hidden from search engines.**

## Stack

- Next.js 16 (App Router, TypeScript), React 19
- Tailwind CSS v4 + shadcn/ui
- Storage: local Redis (`redis`) **or** Upstash (`@upstash/redis`) behind one
  abstraction (`lib/storage`)
- Discord webhook notifications; cron via Vercel or any external scheduler

## Storage backends

The backend is chosen from env at runtime, in this order:

1. `REDIS_URL` → local / self-hosted Redis (e.g. `redis://localhost:6379`)
2. `KV_REST_API_URL` + `KV_REST_API_TOKEN` → Upstash REST (serverless / Vercel)
3. neither set → the app throws a clear error on first request

The rest of the app never knows which backend is live.

## Quick start — Docker (self-host)

```bash
cp .env.example .env      # fill in the values (leave REDIS_URL blank; compose sets it)
docker compose up --build
```

This starts the app on `http://localhost:3000` plus a Redis container with
`appendonly` persistence on a named volume (`redis_data`). Token data survives
restarts, rebuilds, and `docker compose down && up` — it's only lost if you
remove the volume (`docker compose down -v`).

> Set `BASE_URL` to the URL you actually browse (and register the matching
> `<BASE_URL>/api/callback` in Spotify). For Spotify, `http://` is only allowed
> for the `127.0.0.1` loopback — not `localhost`.

## Quick start — Vercel + Upstash

1. Install the **Upstash** integration from the Vercel Marketplace and link it
   to the project — it injects `KV_REST_API_URL` / `KV_REST_API_TOKEN`.
2. Set the remaining env vars (below) in the Vercel project.
3. Deploy. The `vercel.json` cron (`0 9 * * *` → `/api/check`) is picked up
   automatically. Leave `REDIS_URL` unset so Upstash is used.

## Other self-host targets

The container runs anywhere that runs Docker: **Docker Compose, Coolify,
Portainer, CasaOS, Unraid, TrueNAS SCALE, a Linux VPS, Railway, Fly.io,
Render**, etc. Point `REDIS_URL` at a Redis instance (bundled or managed) and
set the env vars. Vercel is just one option, not a requirement.

## Environment variables

Copy `.env.example` to `.env` (Docker) or `.env.local` (local dev) and fill in:

| Var | Notes |
|-----|-------|
| `SPOTIFY_CLIENT_ID` / `SPOTIFY_SECRET_ID` | Default Spotify app credentials (all profiles) |
| `SPOTIFY_CLIENT_ID_<PROFILE>` / `SPOTIFY_SECRET_ID_<PROFILE>` | Optional per-profile override; suffix = profile id upper-cased, `-`→`_` |
| `RETOKEND_SECRET` | Bearer secret consumer projects send to `/api/token` |
| `ADMIN_PASSWORD` | Gates the dashboard and OAuth routes |
| `SESSION_SECRET` | Signs the session + OAuth-state cookies (`openssl rand -hex 32`) |
| `CREDENTIALS_SECRET` | Optional. Encrypts dashboard-entered client secrets; falls back to `SESSION_SECRET` |
| `BASE_URL` | Public ReTokenD URL, no trailing slash; builds the OAuth redirect URI |
| `REDIS_URL` | Local Redis connection string (self-host) — **or** leave blank and use Upstash |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | Upstash (Vercel Marketplace) |
| `CRON_SECRET` | Bearer token `/api/check` requires |
| `DISCORD_WEBHOOK_URL` | Discord webhook for alerts (embeds are labeled per profile) |

Never commit real values — `.gitignore` excludes all `.env*` files.

## Spotify app configuration (one-time)

In the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard),
add these **Redirect URIs** (every profile shares the same callback — the
profile is carried in signed OAuth state, not the URL):

- `https://<your-retokend-domain>/api/callback` (production)
- `http://127.0.0.1:3000/api/callback` (local dev — use `127.0.0.1`, not `localhost`)

Each profile can use its own Spotify app. Set its credentials either in the
dashboard (**Spotify app** section on the profile card — the client secret is
encrypted at rest) or via `SPOTIFY_CLIENT_ID_<PROFILE>` env vars; dashboard
values win. Register the **same** callback URL on every such app.

## Profiles

The dashboard lists one card per profile. `default` is created automatically —
existing single-token installs migrate into it on first load with no manual
step. Add more with **Add profile**, then **Re-authorize** each to grant it a
Spotify login. Cards show status, account, countdown, dates, and scopes, and let
you re-authorize, save scopes, send a test alert, or disable the profile. Saving an
empty scope selection is valid — the next re-auth then requests no scopes (Spotify
grants only its public defaults).

## Consumer projects

```bash
# default profile
curl -H "Authorization: Bearer $RETOKEND_SECRET" https://<retokend>/api/token
# a specific profile
curl -H "Authorization: Bearer $RETOKEND_SECRET" "https://<retokend>/api/token?profile=portfolio"
```

Response: `{ "access_token": "...", "expires_at": <epoch ms>, "profile": "..." }`.
The refresh token is never returned. A `409 { "error": "reauth_required" }`
means Spotify rejected the refresh token — open the dashboard and re-authorize.
Other errors: `401` (bad bearer), `404` (unknown profile), `403` (disabled).

## Cron / scheduled checks

`/api/check` (bearer-gated by `CRON_SECRET`) iterates every enabled profile and
sends Discord alerts on threshold crossings or re-auth. Trigger it daily via:

- **Vercel Cron** — `vercel.json` (already configured), or
- **Any external scheduler** — host cron, [cron-job.org](https://cron-job.org),
  Uptime Kuma, a systemd timer, or GitHub Actions — hitting
  `https://<retokend>/api/check` with `Authorization: Bearer $CRON_SECRET`.

## Security notes

- Secrets live only in env / Redis, never in code. Per-profile client secrets
  entered in the dashboard are stored in Redis AES-256-GCM encrypted (key from
  `CREDENTIALS_SECRET`, falling back to `SESSION_SECRET`).
- `/api/token` is bearer-gated and returns only an access token.
- Human-facing routes are gated by a signed, httpOnly, secure session cookie, with a
  fail-closed proxy matcher (new routes are session-gated by default).
- Logging out revokes **every** outstanding session cookie server-side (a generation
  counter embedded in the cookie is bumped), not just the current browser's cookie.
- Login is rate limited atomically: 10 failed attempts / 15 min per IP, plus a global
  50 / 15 min fallback so a spoofed `X-Forwarded-For` can't buy unlimited guesses.
- Constant-time comparisons for bearer/session checks.
- Hidden from search engines via `robots.ts`, `noindex` metadata, and an
  `X-Robots-Tag` header.
