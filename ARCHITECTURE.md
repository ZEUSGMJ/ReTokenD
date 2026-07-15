# ReTokenD architecture

This document explains how ReTokenD is put together and why its boundaries exist. See [README.md](README.md) for setup and operation, and [BUILD_SPEC.md](BUILD_SPEC.md) for the as-built behavioral contract.

## The problem

Spotify refresh tokens have a six-month lifetime measured from the user's authorization. Exchanging one for a new access token does not extend that lifetime. Without a central service, every project using the same authorization would need a replacement refresh token at the same time.

ReTokenD owns that long-lived credential. Consumer projects ask ReTokenD for short-lived access tokens, and the administrator reauthorizes each Spotify profile from one dashboard when its six-month window ends.

## System at a glance

```text
Consumer projects ── RETOKEND_SECRET ──▶ /api/token ──▶ Spotify token API
       ▲                                     │
       └──────── short-lived access token ───┤
                                             ▼
Admin browser ── signed session ───────▶ ReTokenD ◀──▶ Redis or Upstash
                                             │
Scheduler ───── CRON_SECRET ───────────▶ /api/check ──▶ Discord webhook
```

The service has three separate audiences and authentication boundaries:

| Audience | Entry points | Authentication |
| --- | --- | --- |
| Consumer projects | `/api/token` | `Authorization: Bearer <RETOKEND_SECRET>` |
| Scheduler | `/api/check` | `Authorization: Bearer <CRON_SECRET>` |
| Human administrator | Dashboard, login, and OAuth routes | Signed session cookie |

The refresh token never crosses the service boundary.

## Code map

```text
proxy.ts                     Fail-closed request gate and X-Robots-Tag header
app/page.tsx                 Dynamic dashboard server component
app/login/page.tsx           Password form and rate-limited login action
app/actions.ts               Profile, scope, credential, notification, and session actions
app/api/login/route.ts       Starts Spotify authorization
app/api/callback/route.ts    Completes authorization and stores the refresh token
app/api/token/route.ts       Serves cached or freshly obtained access tokens
app/api/check/route.ts       Runs expiry and reauthorization checks
app/components/              Dashboard components and forms
lib/storage/                 Redis and Upstash adapters
lib/keys.ts                  Redis key definitions and profile-id rules
lib/profiles.ts              Profile registry, enabled state, and legacy migration
lib/spotify.ts               Spotify OAuth, scopes, and credential resolution
lib/lifecycle.ts             Six-month expiry and display-status calculations
lib/session.ts               Storage-free Web Crypto cookie signing and verification
lib/session-server.ts        Redis-backed session generation and revocation
lib/auth.ts                  Constant-time password and bearer helpers
lib/crypto.ts                AES-256-GCM for stored client secrets
lib/notify.ts                Discord notification delivery and embed construction
```

## Runtime boundaries

Next.js 16 runs `proxy.ts` on Node.js, but the proxy intentionally remains storage-free. It verifies only a session cookie's signature and age, which keeps request interception fast and avoids putting a Redis call in front of every route.

`lib/session.ts` uses Web Crypto HMAC-SHA256 and can be shared by the proxy and server routes. `lib/auth.ts`, `lib/crypto.ts`, and `lib/session-server.ts` use Node APIs or storage and belong only in server components, actions, and Node route handlers. Do not import them into `lib/session.ts`.

The Node-dependent route handlers explicitly declare `runtime = "nodejs"`. The dashboard is force-dynamic because it renders current storage state on every request.

## Storage

All persistence goes through `storage` from [lib/storage/index.ts](lib/storage/index.ts). The `StorageAdapter` interface provides `get`, `set`, `setWithTTL`, `del`, `incr`, `acquireLock`, and `releaseLock`.

Adapter selection happens on first use rather than at import time:

1. `REDIS_URL` selects the node-redis adapter and a persistent TCP connection.
2. Otherwise, `KV_REST_API_URL` with `KV_REST_API_TOKEN` selects the stateless Upstash REST adapter.
3. Without either configuration, storage throws a configuration error.

Lazy selection lets `next build` run without live secrets. Both adapters use the same JSON encoding from `lib/storage/types.ts`, so callers see identical values. Development Redis connections are cached on `globalThis` to survive hot reloads.

`incr(key, windowSeconds)` is atomic and sets the expiry only when the key is created. The login rate limiter depends on that fixed window. Locks contain a unique owner, and release is an atomic compare-and-delete so one request cannot release another request's lock.

## Profiles and Redis state

A profile represents one Spotify authorization. All profile state uses the prefix `spotify:<profile>:`. `keysFor()` in [lib/keys.ts](lib/keys.ts) is the only place that constructs these names.

| Suffix | Purpose |
| --- | --- |
| `refresh_token` | Long-lived Spotify credential; never returned to consumers |
| `refresh_token:issued_at` | Start of the six-month window; written only by `/api/callback` |
| `access_token` | Cached `{access_token, expires_at}` with a storage TTL |
| `reauth_required` | Stops refresh attempts after `invalid_grant` |
| `last_refresh` | Time of the most recent successful access-token refresh |
| `scopes` | Saved scope array; an empty array is a valid selection |
| `refresh_lock` | Owner-tagged single-flight lock |
| `enabled` | A stored `"0"` disables the profile; absence means enabled |
| `account_id`, `display_name` | Best-effort Spotify account details |
| `client_id`, `client_secret_enc` | Optional profile-specific Spotify app credentials |
| `notified:reauth`, `notified:<days>` | Successful-notification markers |

The cached access token carries its own `expires_at` in epoch milliseconds. That timestamp is authoritative even if a backend returns a stale value. Its storage TTL is `expires_in - 60` seconds, with a minimum of 60 seconds.

Two keys sit outside the profile namespace:

- `spotify:profiles` is the JSON registry and the source of truth for profile existence.
- `session:generation` is a monotonic value embedded in session cookies for server-side revocation.

`lib/profiles.ts` protects registry read-modify-write operations with an in-process promise-chain mutex. This is sufficient for the single-admin design. Separate serverless instances do not share the mutex, so concurrent profile mutations are intentionally outside the product's expected use.

On first access, the profile layer migrates the older unscoped `spotify:*` token keys into `default`. Those legacy keys are migration input only and are never written again.

## Spotify credentials and scopes

Credentials are resolved as complete id-and-secret pairs in this order:

1. Values saved from the dashboard, with the secret decrypted from Redis.
2. `SPOTIFY_CLIENT_ID_<PROFILE>` and `SPOTIFY_CLIENT_SECRET_<PROFILE>`.
3. The global `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET`.

A pair is never assembled from different sources. The default profile hides its Spotify app form while environment credentials cover it and it has no stored override; other profiles keep the form visible.

`getConfiguredScopes()` returns `DEFAULT_SCOPES` only when no scope array is stored. A saved empty array deliberately requests no optional scopes. Saved changes take effect during the next authorization because scopes are granted at Spotify's authorize step.

## Request flows

### Consumer requests an access token

`GET /api/token?profile=<id>` follows this sequence:

1. Compare the bearer secret in constant time. Reject failures with `401`.
2. Validate the profile id, then read registry membership, enabled state, and the cached access token in parallel. Return `400`, `404`, or `403` in that order when applicable.
3. Return an unexpired cached token immediately.
4. If the refresh token is absent or `reauth_required` is set, return `409` without calling Spotify.
5. Try to acquire the ten-second refresh lock. A losing request polls the cache four times at 500 ms intervals. If the winner does not publish a token, the loser rereads the refresh token and reauthorization flag before using the fallback refresh path.
6. On success, cache the access token, set `last_refresh`, clear a stale reauthorization flag, and store a rotated refresh token if Spotify supplied one. Rotation happens only while holding the lock; `issued_at` is never changed.
7. On `invalid_grant`, set `reauth_required` and return `409` without retrying. Map other Spotify failures to `502`.

The response contains `access_token`, `expires_at`, and `profile` only.

### Administrator reauthorizes a profile

`/api/login?profile=<id>` generates a random OAuth state and stores the signed `{state, profile, iat}` payload in an HTTP-only cookie with a ten-minute lifetime. The profile travels in the signed cookie, allowing every profile to share one registered callback URL.

Spotify redirects to `/api/callback`. The handler verifies the cookie signature and age, compares the returned state, resolves the profile's credentials, and exchanges the authorization code.

A successful callback must contain a non-empty refresh token. ReTokenD stores that token first and then writes `issued_at`; this is the only flow allowed to start a new six-month window. After both writes succeed, it removes the cached access token, reauthorization flag, and notification markers. It then attempts to fetch Spotify account details, registers the profile, and redirects to the dashboard.

### Scheduler checks profile health

`GET /api/check` validates `CRON_SECRET` and visits every enabled profile. A `reauth_required` profile receives one deduplicated alert. Otherwise, the route evaluates the 1-, 7-, and 14-day thresholds from smallest to largest and sends at most one alert per profile per run.

`notify()` reports delivery success and never throws into the cron route. Deduplication markers are written only after Discord accepts the message, so a temporary outage is retried on the next run. When a threshold succeeds, larger implied thresholds are marked too. A successful reauthorization clears every marker.

## Administrator sessions

The login action applies two atomic, fixed-window limits: 10 failures per client IP and 50 failures globally within 15 minutes. The global limit prevents an exposed self-hosted instance from relying entirely on a spoofable forwarded-IP header. Once either limit is reached, even a correct password is rejected until the window expires. An allowed successful login clears its per-IP counter.

After a constant-time password comparison, the action creates a signed 30-day `{iat, gen}` session cookie. The proxy checks its HMAC and age. The dashboard, OAuth start route, and OAuth callback also compare its generation with `session:generation` in Redis. Logout increments that value and deletes the browser cookie, invalidating every previously issued session.

The proxy matcher is fail-closed. Exact `/api/token` and `/api/check` requests bypass session verification because their handlers enforce independent bearer secrets. Similarly named paths remain protected. Static Next.js assets, favicon and image assets, `/robots.txt`, and the renderable `/login` page are excluded or allowed deliberately.

Every proxy response receives `X-Robots-Tag: noindex, nofollow`.

## Secrets and crawler protection

Environment variables hold admin, bearer, signing, encryption, Spotify, storage, callback, cron, and Discord credentials. Redis stores Spotify tokens in plaintext because Redis is part of the trusted server boundary. Dashboard-entered Spotify client secrets are encrypted with AES-256-GCM using `CREDENTIALS_SECRET`, or `SESSION_SECRET` as a fallback, so a Redis dump alone does not expose them.

The private application discourages indexing in three layers: `robots.ts`, no-index metadata, and `X-Robots-Tag` response headers. Authentication remains the actual content boundary.

## Deployment shapes

The same application supports two runtime shapes selected entirely by environment variables:

| | Self-hosted | Vercel |
| --- | --- | --- |
| Application | Standalone Next.js Node server | Serverless functions |
| Storage | Redis over TCP | Upstash REST |
| Scheduler | External authenticated request | `vercel.json` cron |
| Persistence | Redis append-only volume | Managed Upstash database |

The Docker image uses a multi-stage build and runs the minimal standalone output as a non-root user. `docker-compose.yml` supplies Redis 7 with append-only persistence on the `redis_data` volume.
