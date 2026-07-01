# ReTokenD

A private, password-gated Next.js (App Router) app that owns a single Spotify
refresh token, hands short-lived access tokens to other projects, shows a
live countdown to the token's 6-month expiry, and lets you re-authorize with
one click. See `CLAUDE.md` and `BUILD_SPEC.md` for the full design.

## Stack

- Next.js (App Router, TypeScript) on Vercel
- Tailwind CSS + shadcn/ui (card, button, badge)
- `@upstash/redis` for storage (single source of truth for the refresh token)
- Discord webhook for expiry / re-auth notifications
- Vercel Cron for the daily threshold check

## Setup

### 1. Install dependencies

```bash
pnpm install
```

### 2. Spotify app configuration (manual, one-time)

In the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard),
open your **PROD** app (the one whose refresh token this broker will own) and
add these **Redirect URIs**:

- `https://<your-broker-domain>/api/callback` (production)
- `http://127.0.0.1:3000/api/callback` (local dev)

Keep your existing DEV app/redirect URIs untouched if other projects use them
for local development — this broker only needs the PROD app's client ID/secret.

### 3. Discord webhook (manual, one-time)

1. Create a private Discord server (or use an existing one) and a channel for
   alerts.
2. Channel Settings → Integrations → Webhooks → New Webhook.
3. Copy the webhook URL into `DISCORD_WEBHOOK_URL`.
4. Enable mobile push notifications for that channel in the Discord app so
   expiry alerts reach your phone.

### 4. Upstash Redis (Vercel Marketplace)

Install the Upstash integration from the Vercel Marketplace and link it to
this project. It injects `KV_REST_API_URL` and `KV_REST_API_TOKEN`
automatically into your Vercel environment variables — no manual copying
needed for deployed environments. For local dev, pull them with
`vercel env pull` or copy them manually into `.env.local`.

### 5. Environment variables

Copy `.env.example` to `.env.local` and fill in every value:

| Var | Where it comes from |
|-----|----------------------|
| `SPOTIFY_CLIENT_ID` / `SPOTIFY_SECRET_ID` | Spotify Developer Dashboard, PROD app |
| `BROKER_SECRET` | Generate your own random string (e.g. `openssl rand -hex 32`) — shared with consumer projects |
| `ADMIN_PASSWORD` | Pick a strong password |
| `SESSION_SECRET` | Generate your own random string (e.g. `openssl rand -hex 32`) |
| `BASE_URL` | Public broker URL (no trailing slash); `http://127.0.0.1:3000` for local dev |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | Upstash, via Vercel Marketplace integration |
| `CRON_SECRET` | Generate your own random string; Vercel Cron automatically sends it as the bearer token if you set the project's "Cron Job Secret" in Vercel, or set it manually and configure the cron caller to match |
| `DISCORD_WEBHOOK_URL` | From the Discord webhook setup above |

Never commit real values — `.gitignore` excludes all `.env*` files.

### 6. Run locally

```bash
pnpm dev
```

Visit `http://127.0.0.1:3000/login`, sign in with `ADMIN_PASSWORD`, then click
**Re-authorize with Spotify** to perform the first OAuth grant and populate
Redis.

### 7. Deploy

Deploy to Vercel, set all env vars from `.env.example` in the Vercel project
settings (Production + Preview as needed), and set `BASE_URL` to your real
deployed URL. The `vercel.json` cron (`0 9 * * *` → `/api/check`) is picked up
automatically on deploy.

## Consumer projects

Other projects fetch a short-lived access token with:

```bash
curl -H "Authorization: Bearer $BROKER_SECRET" https://<broker-domain>/api/token
```

Response: `{ "access_token": "...", "expires_at": <epoch ms> }`. The endpoint
never returns the refresh token. A `409 { "error": "reauth_required" }`
response means the refresh token was rejected by Spotify (`invalid_grant`) —
visit the dashboard and click **Re-authorize**.

## Security notes

- Secrets live only in environment variables / Redis, never in code.
- `/api/token` is bearer-gated and returns only an access token.
- `/api/check` is gated by `CRON_SECRET`.
- All human-facing routes (`/`, `/login`, `/api/login`, `/api/callback`) are
  gated by a signed, httpOnly, secure session cookie set after a correct
  `ADMIN_PASSWORD`.
- The app is hidden from search engines via `app/robots.ts`, `noindex`
  metadata, and an `X-Robots-Tag` response header.
