# ReTokenD

ReTokenD manages Spotify OAuth tokens for my projects from one self-hosted service.

Spotify applies a six-month refresh-token lifetime to apps created on or after June 18, 2026 and to existing apps from July 20, 2026. I use the Spotify API in several projects, and I didn't want to update every project's refresh token by hand whenever one expired. ReTokenD stores those tokens centrally, issues short-lived access tokens, tracks each expiry window, and gives me one place to re-authorize.

It can run on Docker with Redis or on Vercel with Upstash, and supports one or more Spotify accounts through independent profiles.

> Not affiliated with Spotify. You provide your own Spotify Developer credentials.

## Features

- Self-host with Docker + Redis or deploy on Vercel + Upstash.
- Manage multiple Spotify profiles from a single instance.
- Refresh tokens never leave the server. `/api/token` only returns an access token.
- Track the remaining lifetime of each refresh token.
- Optional Discord notifications for expiry and re-authorization.
- Password-protected dashboard.

## Stack

- Next.js 16 (App Router, TypeScript), React 19
- Tailwind CSS v4 + shadcn/ui
- Redis or Upstash through a shared storage abstraction (`lib/storage`)
- Discord webhooks
- Vercel Cron or any external scheduler

## Storage

The storage backend is selected from the available environment variables:

1. `REDIS_URL` → local / self-hosted Redis (`redis://localhost:6379`)
2. `KV_REST_API_URL` + `KV_REST_API_TOKEN` → Upstash REST
3. Otherwise the app throws an error on its first storage access.

All application storage goes through `lib/storage`, so the rest of the code doesn't need to know which backend is active.

## Running with Docker

```bash
cp .env.example .env
docker compose up --build
```

This starts the app on `http://localhost:3000` alongside a Redis container with `appendonly` persistence on a named volume (`redis_data`). Token data survives restarts and rebuilds. Deleting the volume with `docker compose down -v` removes it.

> Set `BASE_URL` to the URL you'll actually use and register `<BASE_URL>/api/callback` in the Spotify Developer Dashboard. Spotify only allows plain HTTP for the `127.0.0.1` loopback, not `localhost`.

## Running on Vercel

1. Install the Upstash integration from the Vercel Marketplace.
2. Configure the remaining environment variables.
3. Deploy.

The cron defined in `vercel.json` (`0 9 * * *` → `/api/check`) is picked up automatically. Leave `REDIS_URL` unset so the Upstash backend is used.

## Other deployments

The container runs anywhere Docker is supported, including Docker Compose, Coolify, Portainer, CasaOS, Unraid, TrueNAS SCALE, Railway, Fly.io, Render, or a Linux VPS.

Point `REDIS_URL` at a Redis instance and configure the required environment variables.

## Environment variables

Copy `.env.example` to `.env` (Docker) or `.env.local` (local development).

| Variable | Purpose |
| ---------- | ------- |
| `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` | Default Spotify app credentials |
| `SPOTIFY_CLIENT_ID_<PROFILE>` / `SPOTIFY_CLIENT_SECRET_<PROFILE>` | Optional per-profile credentials |
| `RETOKEND_SECRET` | Bearer secret for `/api/token` |
| `ADMIN_PASSWORD` | Dashboard password |
| `SESSION_SECRET` | Session and OAuth state signing key |
| `CREDENTIALS_SECRET` | Optional encryption key for stored client secrets |
| `BASE_URL` | Public URL used for OAuth callbacks |
| `REDIS_URL` | Local Redis connection string |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | Upstash REST credentials |
| `CRON_SECRET` | Bearer secret for `/api/check` |
| `DISCORD_WEBHOOK_URL` | Discord webhook for notifications |

Never commit real values. `.gitignore` excludes all `.env*` files.

## Spotify setup

In the Spotify Developer Dashboard, add the following redirect URIs:

- `https://<your-domain>/api/callback`
- `http://127.0.0.1:3000/api/callback`

Every profile shares the same callback URL. The selected profile is stored in the signed OAuth state, not in the callback URL.

Each profile can use its own Spotify application. Credentials can be configured through the dashboard or with `SPOTIFY_CLIENT_ID_<PROFILE>` / `SPOTIFY_CLIENT_SECRET_<PROFILE>`. Dashboard values take precedence.

## Profiles

Profiles represent independent Spotify authorizations.

`default` is created automatically. Existing single-profile installations are migrated into it on first launch.

Additional profiles can be created from the dashboard. Each profile has its own:

- Refresh token
- OAuth scopes
- Countdown
- Spotify app credentials (optional)
- Account information
- Enabled/disabled state

Saving an empty scope selection is valid. The next authorization requests no additional scopes beyond Spotify's defaults.

## Using the API

```bash
# Default profile
curl -H "Authorization: Bearer $RETOKEND_SECRET" \
  https://<retokend>/api/token

# Named profile
curl -H "Authorization: Bearer $RETOKEND_SECRET" \
  "https://<retokend>/api/token?profile=portfolio"
```

Example response:

```json
{
  "access_token": "...",
  "expires_at": 1750000000000,
  "profile": "portfolio"
}
```

The refresh token is never returned.

Possible responses:

- `400` — Invalid profile id
- `401` — Invalid bearer token
- `403` — Profile disabled
- `404` — Unknown profile
- `409` — Re-authorization required
- `502` — Spotify token service error

## Scheduled checks

`/api/check` checks every enabled profile for expiry thresholds or re-authorization requirements.

It can be triggered with:

- Vercel Cron
- Host cron
- cron-job.org
- GitHub Actions
- systemd timers
- Uptime Kuma
- Any scheduler capable of sending an authenticated HTTP request

## Website

`site/` contains the public landing page. It is a standalone Next.js app, developed and deployed separately from ReTokenD itself. Run it with `cd site && pnpm install --ignore-workspace && pnpm dev`; it uses port 3001. The `--ignore-workspace` flag is required because pnpm otherwise attaches to the repository workspace and installs nothing in `site/`.

It deploys as a separate Vercel project with Root Directory set to `site`. Optionally set the project's Ignored Build Step to `git diff --quiet HEAD^ HEAD -- .` so it only redeploys when `site/` changes.

Unlike the app, the landing page is public and indexable.

## Security

- Refresh tokens stay in Redis and are never exposed through the API.
- Per-profile client secrets are encrypted with AES-256-GCM before being stored.
- Human-facing routes require authentication.
- `/api/token` and `/api/check` use bearer authentication.
- Login attempts are rate limited.
- Session and bearer comparisons use constant-time checks.
- The application is hidden from search engines through `robots.ts`, `noindex` metadata, and the `X-Robots-Tag` response header.
