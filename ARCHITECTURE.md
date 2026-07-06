# ReTokenD — Architecture

How ReTokenD is put together and why. For setup and usage, see [README.md](README.md); for the original requirements, see [BUILD_SPEC.md](BUILD_SPEC.md).

## The problem it solves

Spotify refresh tokens expire 6 months after authorization, and refreshing does **not** extend that window. Instead of pasting a new refresh token into every consuming project twice a year, ReTokenD owns the refresh token(s) centrally: consumers ask it for short-lived access tokens, and when the 6-month window closes, one click on the dashboard re-authorizes and heals every consumer at once.

## System overview

```
┌─────────────┐   Bearer RETOKEND_SECRET  ┌──────────────────────────┐
│ Consumer    │ ─────────────────────────▶│  /api/token              │
│ projects    │ ◀───── access token ───── │  (never refresh token)   │
└─────────────┘                           │                          │
                                          │        ReTokenD          │
┌─────────────┐   session cookie          │  ┌────────────────────┐  │      ┌─────────┐
│ You         │ ─────────────────────────▶│  │ Dashboard (/)      │  │◀────▶│  Redis  │
│ (browser)   │                           │  │ /api/login         │──┼──┐   │ or      │
└─────────────┘                           │  │ /api/callback      │  │  │   │ Upstash │
                                          │  └────────────────────┘  │  │   └─────────┘
┌─────────────┐   Bearer CRON_SECRET      │  ┌────────────────────┐  │  │
│ Scheduler   │ ─────────────────────────▶│  │ /api/check (cron)  │  │  ▼
│ (Vercel/ext)│                           │  └────────────────────┘  │ Spotify OAuth
└─────────────┘                           └──────────┬───────────────┘ (accounts.spotify.com)
                                                     ▼
                                             Discord webhook (alerts)
```

Three independent auth perimeters, three audiences:

| Audience | Routes | Auth |
|---|---|---|
| Consumer projects | `/api/token` | `Authorization: Bearer RETOKEND_SECRET` |
| Cron scheduler | `/api/check` | `Authorization: Bearer CRON_SECRET` |
| Human admin | `/`, `/login`, `/api/login`, `/api/callback` | Signed session cookie (password login, rate-limited) |

## Layout

```
proxy.ts                  Middleware (Next 16 "proxy" convention). Edge runtime.
                          Fail-closed matcher: gates everything except the bearer APIs
                          and static assets behind the session cookie; adds X-Robots-Tag.
app/
  page.tsx                Dashboard: one card per profile (server component, force-dynamic).
  login/page.tsx          Password form + `login` server action (rate-limited).
  actions.ts              Server actions: scopes, credentials, enable/disable, create/delete
                          profile, test notification, logout.
  api/login/route.ts      Starts OAuth: sets signed state cookie, redirects to Spotify.
  api/callback/route.ts   Finishes OAuth: verifies state, exchanges code, stores tokens.
  api/token/route.ts      Hands access tokens to consumers (cache → refresh, single-flight).
  api/check/route.ts      Cron: expiry-threshold + re-auth Discord alerts per profile.
  components/             Dashboard UI (ProfileCard, Countdown, forms). components/ui/ is shadcn.
lib/
  storage/                Backend-agnostic Redis abstraction (see below).
  keys.ts                 Pure string logic: per-profile Redis key factory, profile-id rules.
  profiles.ts             Stateful profile layer: registry, enabled flags, legacy migration.
  spotify.ts              Spotify OAuth calls, scope catalog, per-profile credential resolution.
  session.ts              Edge-safe signed-cookie helpers (Web Crypto HMAC). No Node APIs.
  session-server.ts       Node-only: session generation (server-side revocation) helpers.
  lifecycle.ts            Shared token countdown/status math (expiresAt, daysLeft, status).
  auth.ts                 Node-only: constant-time compares, bearer check, SESSION_SECRET guard.
  crypto.ts               Node-only: AES-256-GCM for client secrets stored at rest.
  notify.ts               Discord webhook (fails soft — never throws).
  utils.ts                shadcn `cn()` class-merge helper.
```

## The Edge / Node runtime split

`proxy.ts` (middleware) may run on the Edge runtime (on Vercel), so everything it
imports must avoid Node-only APIs:

- **`lib/session.ts`** — Edge-safe. Signs/verifies cookies with `crypto.subtle` (Web Crypto HMAC-SHA256). Imported by the proxy *and* by Node routes.
- **`lib/auth.ts`, `lib/crypto.ts`, `lib/session-server.ts`** — Node-only (`node:crypto` / storage). Imported only by route handlers, server actions, and pages, which all declare `runtime = "nodejs"` or run in the Node server anyway.

Do not import `lib/auth.ts`, `lib/crypto.ts`, or `lib/session-server.ts` into `proxy.ts` or `lib/session.ts`.

## Storage abstraction

Everything reads/writes through `storage` ([lib/storage/index.ts](lib/storage/index.ts)) — a small `StorageAdapter` interface (`get/set/setWithTTL/del/incr/acquireLock`). `incr(key, windowSeconds)` is an atomic counter (INCR, with the expiry window set only when the key is newly created) used by the login rate limiter. Two adapters:

1. **node-redis** ([lib/storage/node-redis.ts](lib/storage/node-redis.ts)) — chosen when `REDIS_URL` is set. One persistent TCP connection, cached on `globalThis` so dev hot-reload doesn't leak clients. For long-lived servers (Docker, VPS).
2. **Upstash REST** ([lib/storage/upstash.ts](lib/storage/upstash.ts)) — chosen when `KV_REST_API_URL`/`KV_REST_API_TOKEN` are set. Stateless HTTPS per call. For serverless (Vercel).

Both JSON-encode values identically (`encode`/`decode` in [lib/storage/types.ts](lib/storage/types.ts)), so the on-wire format is backend-independent. Adapter selection is lazy (first use, not import time) so `next build` — which has no secrets — never trips the "no backend configured" error.

## Profiles

A **profile** is one independent Spotify authorization (`default`, `portfolio`, …). All state for a profile lives under the Redis prefix `spotify:<profile>:` — the full key list is the `keysFor()` factory in [lib/keys.ts](lib/keys.ts). The important ones:

| Key | Meaning |
|---|---|
| `refresh_token` | The long-lived Spotify refresh token. Never leaves the server. |
| `refresh_token:issued_at` | Start of the 6-month window. **Reset only on full re-auth** (`/api/callback`), never on refresh — Spotify doesn't extend the window on refresh. Drives the countdown. |
| `access_token` | Cached token as JSON `{access_token, expires_at}`, TTL = `expires_in − 60s` (min 60s). `expires_at` (epoch ms) is authoritative; a value at/after it is treated as a miss. |
| `reauth_required` | Set when Spotify answers `invalid_grant`. Blocks further refresh attempts. |
| `refresh_lock` | Single-flight lock (`SET NX EX`) around the Spotify refresh call. |
| `scopes` | Saved scope selection (applies on next re-auth). |
| `client_id` / `client_secret_enc` | Optional per-profile Spotify app; secret AES-encrypted. |
| `enabled` | `"0"` disables the profile (skipped by `/api/token` and cron). |
| `notified:<days>` / `notified:reauth` | Alert dedupe flags, cleared on re-auth. |

Two non-profile keys: `spotify:profiles` (the registry, above) and `session:generation` — a monotonic counter embedded in every session cookie; `logout()` bumps it to revoke all outstanding cookies server-side (see [Admin session](#admin-session)).

The registry (`spotify:profiles`, a JSON array) is the source of truth for which profiles exist. [lib/profiles.ts](lib/profiles.ts) guards registry read-modify-writes with an **in-process promise-chain mutex** (fine for a single server; on serverless each instance has its own chain — acceptable for a single-admin app). On first use it migrates legacy pre-profile keys (`spotify:refresh_token`, …) into the `default` profile, so old installs heal themselves.

Per-profile Spotify credentials resolve in this order ([lib/spotify.ts](lib/spotify.ts) `credentialsFor`): dashboard-entered creds in Redis (secret decrypted) → `SPOTIFY_CLIENT_ID_<PROFILE>` env pair → global `SPOTIFY_CLIENT_ID` env pair. Stored and env creds are used as coherent pairs, never mixed. On the dashboard, the `default` profile's **Spotify app** panel is hidden while env credentials cover it and no custom app is stored (`hasEnvCredentials` in lib/spotify.ts) — it's always shown on other profiles.

## Request flows

### Consumer fetches a token — `GET /api/token?profile=x`

1. Bearer check (`RETOKEND_SECRET`, constant-time) → 401.
2. Valid id → 400. Then the registry, `enabled` flag, and cached token are read in parallel (`Promise.all`); the response branches to preserve ordering: registered → 404, enabled → 403.
3. **Cache hit**: the cached `{access_token, expires_at}` blob exists and hasn't expired → return it (single `get`, no TTL round trip; `expires_at` is authoritative).
4. No refresh token stored, **or** `reauth_required` flag set → `409 { error: "reauth_required" }`. The flag means Spotify said `invalid_grant`; per spec ReTokenD never retries until a human re-authorizes.
5. **Single-flight refresh**: try `refresh_lock` (`SET NX EX 10`). Losers poll the cache ~2s (4 × 500ms) and return the winner's token; if the winner stalls, a loser **re-reads `refresh_token` and `reauth_required`** (409 if now flagged) before falling through to a fallback refresh with the fresh token (safety valve).
6. Call Spotify's refresh endpoint. On success: cache the access token as `{access_token, expires_at}` (TTL `expires_in − 60`), record `last_refresh`, clear a stale `reauth_required`, and if Spotify rotated the refresh token, store the new one — **only while holding the lock** (a loser must not clobber the winner's rotation) and **without touching `issued_at`**. On `invalid_grant`: set `reauth_required`, return 409. Other errors: 502.

The response never contains the refresh token.

### Re-authorization — `/api/login` → Spotify → `/api/callback`

1. `/api/login?profile=x` (session-gated by the proxy) creates a random `state`, wraps `{state, profile, iat}` in an HMAC-signed, httpOnly cookie (10-min max age), and redirects to Spotify's consent page with the profile's configured scopes.
2. Spotify redirects back to `/api/callback?code&state`. The handler verifies the signed cookie (tamper-proof), matches `state`, and recovers the profile — the profile travels in the signed cookie, not the URL, so one registered redirect URI serves every profile.
3. The code is exchanged for tokens using the profile's credentials. The response's `refresh_token` is validated present, then atomically: store it, **reset `issued_at` (the only place this happens)**, drop the cached access token, clear `reauth_required` and all notification-dedupe flags.
4. Best-effort: fetch the Spotify account (id/display name) for the dashboard card, register the profile, redirect to `/`.

### Daily cron — `GET /api/check`

Bearer-gated by `CRON_SECRET`. For each **enabled** profile: if `reauth_required`, send one Discord alert (deduped via `notified:reauth`); otherwise compare days-left against thresholds (ascending 1/7/14) and fire only the smallest not-yet-notified one per run. `notify()` returns whether delivery succeeded (2xx), and a dedupe flag is set **only on successful delivery** — a Discord outage retries on the next run. When a threshold fires, the flags for all larger thresholds are set too (they're implied), so a single run doesn't emit stale follow-ups. Dedupe flags are cleared on re-auth, so each incident alerts once. `notify()` fails soft — a Discord outage can't fail the cron.

### Admin session

`POST` login server action: an **atomic dual rate limit** (per-IP `login:fail:<ip>` at 10/15 min plus a global `login:fail:global` at 50/15 min, both via `storage.incr` so a spoofed `X-Forwarded-For` on a direct-exposed self-host can't buy unlimited guesses; both cleared/decayed on success/window), constant-time password compare against `ADMIN_PASSWORD`, then set an HMAC-signed `{iat, gen}` cookie (30-day max age) embedding the current `session:generation`.

**Auth is split across the Edge/Node boundary.** The proxy (Edge, storage-free) verifies only the cookie **signature + age** — cheap and matcher-driven, so it fail-closes on every route by default. The **generation check** (server-side revocation) needs storage, so it runs Node-side at the top of `/` (`app/page.tsx`), `/api/login`, and `/api/callback` via `isSessionCurrent()` ([lib/session-server.ts](lib/session-server.ts)), redirecting to `/login` when the cookie's `gen` no longer matches Redis. `logout()` bumps `session:generation` (revoking every outstanding cookie) then deletes the cookie. `/api/token` and `/api/check` have their own bearer auth and are excluded from the matcher. Server actions are protected because they POST to `/`, which the proxy covers.

The proxy matcher is **inverted / fail-closed**: it protects everything except `api/token`, `api/check`, Next static assets (`_next/static`, `_next/image`, `favicon.ico`, `robots.txt`, and `.svg/.png/.ico` files), so any new route is session-gated by default. `/login` and `/robots.txt` skip the cookie check so the login form renders unauthenticated. `X-Robots-Tag: noindex, nofollow` is set on every response.

## Secrets model

- **Env**: `ADMIN_PASSWORD`, `SESSION_SECRET` (cookie HMAC; `getSessionSecret()` refuses to run with it empty), `CREDENTIALS_SECRET` (optional, falls back to `SESSION_SECRET`), `RETOKEND_SECRET`, `CRON_SECRET`, global Spotify creds, `BASE_URL`, `DISCORD_WEBHOOK_URL`.
- **Redis**: refresh/access tokens (plaintext — Redis is the trust boundary), and per-profile client secrets encrypted with AES-256-GCM ([lib/crypto.ts](lib/crypto.ts)); the key is derived from `CREDENTIALS_SECRET` (fallback `SESSION_SECRET`), so a Redis dump alone can't reveal them.
- Nothing secret in code or committed files. The app is hidden from crawlers three ways: `robots.ts`, `noindex` metadata, and `X-Robots-Tag` headers from both `next.config.ts` and the proxy.

## Deployment modes

Same codebase, two shapes — chosen purely by env:

| | Self-host (Docker/homelab) | Vercel |
|---|---|---|
| Server | `output: "standalone"` Node server (`server.js`) | Serverless functions |
| Storage | `REDIS_URL` → node-redis (TCP) | Upstash REST |
| Cron | External scheduler hits `/api/check` with the bearer | `vercel.json` cron (auto-sends `Bearer CRON_SECRET`) |
| Middleware | Runs in the Node server process | Edge runtime |

`docker-compose.yml` bundles the app with a Redis 7 container (`appendonly` persistence on the `redis_data` named volume — token data survives rebuilds). The Dockerfile is a multi-stage build (base → deps → build → minimal runtime) running as a non-root user; only the standalone bundle, static assets, and `public/` ship in the final image.
