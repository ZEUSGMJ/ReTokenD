# ReTokenD

ReTokenD is the small, private service I use to manage Spotify OAuth tokens for my projects.

[Spotify refresh tokens now have a six-month lifetime](https://developer.spotify.com/blog/2026-06-18-refresh-token-expiration): the policy applies to newly created apps from June 18, 2026, and to existing apps from July 20, 2026. Refreshing an access token does not restart that clock. I built ReTokenD so I can reauthorize a Spotify account once instead of replacing a refresh token in every project that uses it.

ReTokenD keeps refresh tokens on the server, gives trusted consumers short-lived access tokens, tracks each authorization window, and warns me before a profile needs attention. It supports multiple Spotify accounts or apps through independent profiles.

It runs either as a Docker service backed by Redis or on Vercel with Upstash.

> ReTokenD is not affiliated with Spotify. You need your own Spotify Developer credentials.

## What it does

- Manages one or more independent Spotify profiles from a password-protected dashboard.
- Keeps refresh tokens server-side; `/api/token` returns access tokens only.
- Caches access tokens so consumers do not hit Spotify unnecessarily.
- Shows when each six-month authorization window ends.
- Supports profile-specific scopes and Spotify app credentials.
- Sends optional Discord alerts before expiry or when reauthorization is required.
- Runs with Docker and Redis or with Vercel and Upstash.

## Requirements

- A Spotify Developer app
- A Redis instance or an Upstash database
- Node.js and pnpm for local development, or Docker for a containerized deployment
- A Discord webhook if you want notifications

## Choose a storage backend

ReTokenD selects storage from its environment:

1. If `REDIS_URL` is set, it uses Redis over TCP.
2. Otherwise, if `KV_REST_API_URL` and `KV_REST_API_TOKEN` are set, it uses Upstash REST.
3. If neither backend is configured, the first storage operation fails with a configuration error.

`REDIS_URL` wins when both configurations are present. The rest of the app talks only to `lib/storage`, so its behavior is the same with either backend.

## Run with Docker

```bash
cp .env.example .env
docker compose up --build
```

The Compose stack starts ReTokenD at `http://localhost:3000` with Redis 7. Redis uses append-only persistence on the `redis_data` volume, so tokens survive restarts and rebuilds. Running `docker compose down -v` also deletes that data.

Set `BASE_URL` to the address you will actually use and register `<BASE_URL>/api/callback` in the Spotify Developer Dashboard.

> For local OAuth, use `http://127.0.0.1:3000`, not `http://localhost:3000`. Spotify permits plain HTTP for the loopback IP address only.

## Deploy on Vercel

1. Import the repository into Vercel.
2. Install Upstash from the Vercel Marketplace so the `KV_REST_API_*` variables are injected.
3. Add the remaining environment variables and leave `REDIS_URL` unset.
4. Register `https://<your-domain>/api/callback` with Spotify.
5. Deploy.

Vercel reads the daily `/api/check` schedule from `vercel.json`. ReTokenD also works on any platform that can run its Docker image and connect to Redis; use an external scheduler for `/api/check` in that case.

## Configuration

Copy `.env.example` to `.env.local` for local development or `.env` for Docker. Never commit real values; `.gitignore` excludes `.env*` while keeping `.env.example` tracked.

| Variable | Purpose |
| --- | --- |
| `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` | Default Spotify app credentials |
| `SPOTIFY_CLIENT_ID_<PROFILE>` / `SPOTIFY_CLIENT_SECRET_<PROFILE>` | Optional credentials for one profile |
| `RETOKEND_SECRET` | Bearer secret accepted by `/api/token` |
| `ADMIN_PASSWORD` | Password for the dashboard |
| `SESSION_SECRET` | Key used to sign session and OAuth-state cookies |
| `CREDENTIALS_SECRET` | Optional key for encrypting dashboard-stored client secrets; falls back to `SESSION_SECRET` |
| `BASE_URL` | Public origin used to construct the OAuth callback URL |
| `REDIS_URL` | Redis connection string for self-hosting |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | Upstash REST credentials |
| `CRON_SECRET` | Bearer secret accepted by `/api/check` |
| `DISCORD_WEBHOOK_URL` | Optional Discord webhook for alerts |

For a named profile, replace `<PROFILE>` with the uppercased profile id and convert hyphens to underscores. For example, `my-player` uses `SPOTIFY_CLIENT_ID_MY_PLAYER`.

## Configure Spotify

Add the appropriate callback URLs in the Spotify Developer Dashboard:

- Production: `https://<your-domain>/api/callback`
- Local development: `http://127.0.0.1:3000/api/callback`

Every profile uses the same callback URL. ReTokenD keeps the selected profile in its signed OAuth-state cookie rather than adding it to the callback URL.

Profiles can share the default Spotify app or use their own credentials. Dashboard-stored credentials take precedence over profile-specific environment variables, which take precedence over the global credentials.

## Profiles and scopes

A profile is one independent Spotify authorization. The `default` profile is created automatically, and older single-profile installations migrate into it on first use.

Each profile has its own refresh token, scopes, countdown, account details, enabled state, and optional Spotify app credentials. Create additional profiles from the dashboard.

If a profile has never saved a scope selection, ReTokenD requests its three default scopes. Saving an empty selection is different: the next authorization requests no optional scopes.

## Use the token API

Send the shared bearer secret with every request:

```bash
# Default profile
curl -H "Authorization: Bearer $RETOKEND_SECRET" \
  https://<retokend>/api/token

# Named profile
curl -H "Authorization: Bearer $RETOKEND_SECRET" \
  "https://<retokend>/api/token?profile=portfolio"
```

Successful response:

```json
{
  "access_token": "...",
  "expires_at": 1750000000000,
  "profile": "portfolio"
}
```

The endpoint never returns a refresh token.

| Status | Meaning |
| --- | --- |
| `400` | Invalid profile id |
| `401` | Missing or invalid bearer secret |
| `403` | Profile disabled |
| `404` | Profile not found |
| `409` | Profile must be reauthorized |
| `502` | Spotify token service failed |

## Schedule token checks

`GET /api/check` examines every enabled profile for expiry thresholds and reauthorization flags. Requests must include `Authorization: Bearer <CRON_SECRET>`.

Vercel runs the included schedule at 09:00 UTC each day. A self-hosted instance can use host cron, systemd, GitHub Actions, Uptime Kuma, cron-job.org, or any scheduler that can send an authenticated HTTP request.

## Security model

- Refresh tokens stay in Redis and never appear in API responses.
- Dashboard-stored Spotify client secrets are encrypted with AES-256-GCM.
- Human-facing routes require the admin session.
- Consumer and cron endpoints use separate bearer secrets.
- Password attempts are rate-limited per IP and globally.
- Password and bearer comparisons use constant-time helpers.
- Session and OAuth-state cookies are signed, HTTP-only, and secure.
- The application blocks indexing with `robots.txt`, metadata, and `X-Robots-Tag` headers.

For design details and trust boundaries, see [ARCHITECTURE.md](ARCHITECTURE.md).

## Public website

The `site/` directory contains ReTokenD's public landing page. It is a separate Next.js application and should be deployed as its own Vercel project with `site` as the Root Directory.

Run it locally on port 3001:

```bash
cd site
pnpm install --ignore-workspace
pnpm dev
```

The `--ignore-workspace` flag keeps pnpm from attaching the standalone site to the root workspace. Unlike the token manager, the landing page is public and indexable.
