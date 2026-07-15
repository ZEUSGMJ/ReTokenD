# ReTokenD build specification

This is the behavioral contract for the current multi-profile implementation of ReTokenD. It supersedes the original single-token, Upstash-only version. Read [CLAUDE.md](CLAUDE.md) before changing the implementation and [ARCHITECTURE.md](ARCHITECTURE.md) for design rationale.

## Product contract

ReTokenD is a private, single-admin Next.js application that owns Spotify refresh tokens for one or more profiles. Trusted projects authenticate to ReTokenD and receive short-lived access tokens. They never receive the underlying refresh token.

Spotify measures a refresh token's six-month lifetime from the user's authorization. Refreshing an access token does not extend that window. ReTokenD therefore records the authorization time, warns before expiry, and provides one reauthorization flow that repairs every consumer of the same profile.

The implementation must preserve these invariants:

- Secrets live only in environment variables or Redis.
- `/api/token` never returns a refresh token.
- `/api/callback` is the only code path allowed to write `refresh_token:issued_at`.
- A normal access-token refresh may rotate the refresh token but must not alter `issued_at`.
- Spotify `invalid_grant` stops further refresh attempts until a human reauthorizes the profile.
- Every human-facing route requires the administrator session, apart from the login page itself.

## Platform

- Next.js 16 App Router with TypeScript and React 19
- Tailwind CSS v4 and shadcn/ui, dark mode only
- Inter for interface text and JetBrains Mono for countdown values
- One storage abstraction with Redis and Upstash adapters
- Discord webhooks for optional notifications
- Vercel Cron or any external authenticated scheduler
- No user database or account system beyond the single administrator password

The self-hosted build uses Next.js standalone output. Storage selection happens lazily on first use: `REDIS_URL` selects node-redis; otherwise the `KV_REST_API_URL` and `KV_REST_API_TOKEN` pair selects Upstash REST; otherwise storage throws. The Upstash client disables automatic deserialization so both adapters share the same encoding behavior.

## Environment contract

| Variable | Requirement |
| --- | --- |
| `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` | Default Spotify credential pair |
| `SPOTIFY_CLIENT_ID_<PROFILE>` / `SPOTIFY_CLIENT_SECRET_<PROFILE>` | Optional profile-specific pair; profile id is uppercased and hyphens become underscores |
| `RETOKEND_SECRET` | Bearer secret for `/api/token` |
| `ADMIN_PASSWORD` | Administrator password |
| `SESSION_SECRET` | HMAC key for session and OAuth-state cookies; fallback encryption key |
| `CREDENTIALS_SECRET` | Optional dedicated key for dashboard-stored Spotify client secrets |
| `BASE_URL` | Public origin used for `${BASE_URL}/api/callback` |
| `REDIS_URL` | Redis connection string; takes precedence over Upstash |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | Upstash REST configuration |
| `CRON_SECRET` | Bearer secret for `/api/check` |
| `DISCORD_WEBHOOK_URL` | Optional Discord notification destination |

`.env.example` lists every supported variable with empty values. No populated `.env*` file may be committed.

## Profile and storage contract

Profile ids must match `^[a-z0-9-]{1,32}$`. `default` is created automatically and cannot be deleted. `spotify:profiles`, stored as a JSON array, is the source of truth for registered profiles.

Every profile owns these keys under `spotify:<profile>:`:

| Suffix | Value and behavior |
| --- | --- |
| `refresh_token` | Current Spotify refresh token; replaced on authorization and optional rotation |
| `refresh_token:issued_at` | ISO timestamp written only after a full authorization succeeds |
| `access_token` | JSON `{access_token, expires_at}`; TTL is `max(expires_in - 60, 60)` seconds |
| `reauth_required` | `"1"` after `invalid_grant`; cleared by successful reauthorization |
| `last_refresh` | ISO timestamp of the latest successful access-token refresh |
| `scopes` | JSON array of selected scope ids; `[]` is valid |
| `refresh_lock` | Unique owner with a ten-second TTL and atomic owner-checked release |
| `enabled` | `"0"` disables the profile; absent or any other value means enabled |
| `account_id`, `display_name` | Best-effort Spotify account metadata |
| `client_id`, `client_secret_enc` | Optional dashboard-stored Spotify app credentials |
| `notified:reauth` | Successful reauthorization-alert marker |
| `notified:1`, `notified:7`, `notified:14` | Successful expiry-alert markers |

`expires_at`, stored in epoch milliseconds, is authoritative for access-token cache validity. A cached value at or after its expiry is a miss even if the backend still returns it.

`session:generation` is a monotonic global key used to revoke existing administrator cookies. Older non-profile Spotify keys are migration input only: first-time initialization copies them into `default` and never writes them again.

## Credentials and scopes

Spotify credentials resolve as coherent pairs in this order:

1. Dashboard-stored profile credentials
2. Profile-specific environment credentials
3. Global environment credentials

The client secret stored from the dashboard is encrypted with AES-256-GCM using `CREDENTIALS_SECRET`, falling back to `SESSION_SECRET`. Ids and secrets from different sources must never be mixed.

When no scope array exists, the authorization request uses:

```text
user-top-read
user-read-currently-playing
user-read-recently-played
```

An explicitly stored empty array requests no optional scopes. The dashboard accepts only ids in `SPOTIFY_SCOPE_CATALOG`; saved selections apply on the next authorization.

## HTTP routes

### `GET /api/login?profile=<id>`

This administrator-session route starts Spotify authorization.

- Default the profile to `default` and reject an invalid id with `400 invalid_profile`.
- Confirm the administrator session generation is current.
- Generate a random state and place signed `{state, profile, iat}` data in the HTTP-only `retokend_oauth_state` cookie for ten minutes.
- Redirect to Spotify with `response_type=code`, the resolved client id, configured scopes, `${BASE_URL}/api/callback`, the random state, and `show_dialog=true`.

### `GET /api/callback`

This administrator-session route completes authorization.

- Confirm the administrator session generation is current.
- Verify the OAuth-state cookie signature, age, and query-state match. Recover the profile from the cookie rather than the callback URL.
- Exchange the code using the profile's resolved credentials and exact redirect URI.
- Require a non-empty refresh token. If it is missing, show an error and write no token lifecycle state.
- Store `refresh_token` first, then set `refresh_token:issued_at` to the current ISO timestamp.
- Only after both writes succeed, delete the access-token cache, reauthorization flag, and every notification marker.
- Fetch `/v1/me` and store account metadata on a best-effort basis, register the profile, then redirect to `/`.
- Render a clear error response for missing parameters, invalid state, or exchange failures.

### `GET /api/token?profile=<id>`

This consumer route requires `Authorization: Bearer <RETOKEND_SECRET>`. The profile defaults to `default`.

Validation and error order:

| Condition | Response |
| --- | --- |
| Invalid bearer secret | `401 {error: "unauthorized"}` |
| Invalid profile id | `400 {error: "invalid_profile"}` |
| Unregistered profile | `404 {error: "unknown_profile"}` |
| Disabled profile | `403 {error: "profile_disabled"}` |
| Missing refresh token or reauthorization flag | `409 {error: "reauth_required", profile}` |

The registry, enabled flag, and cached token are read in parallel, while responses preserve the order above. An unexpired cached token returns immediately as `{access_token, expires_at, profile}`.

On a cache miss:

1. Stop with `409` when the refresh token is absent or `reauth_required` is set; do not call Spotify.
2. Acquire the owner-tagged ten-second refresh lock.
3. A loser polls the cache four times at 500 ms intervals. Before falling back to its own refresh, it rereads both the refresh token and reauthorization flag.
4. Refresh through Spotify using the resolved credential pair.
5. On success, cache `{access_token, expires_at}`, update `last_refresh`, clear a stale reauthorization flag, and store a returned replacement refresh token only while holding the lock. Never write `issued_at`.
6. On `invalid_grant`, set `reauth_required`, do not retry, and return `409`.
7. Return `502 {error: "spotify_error"}` for other Spotify failures.

Lock release must compare the stored owner before deletion. No response may include the refresh token.

### `GET /api/check`

This scheduler route requires `Authorization: Bearer <CRON_SECRET>` and returns `{ok: true, notifications}`.

- Iterate only enabled profiles.
- If `reauth_required` is set, send one alert per incident and use `notified:reauth` for deduplication.
- Otherwise evaluate the 1-, 7-, and 14-day thresholds in ascending order and send at most one alert per profile per run.
- Write deduplication markers only after successful notification delivery.
- When a smaller threshold fires, also mark every larger threshold as implied.
- Let notification failures retry on the next run; delivery errors must not fail the route.

### Dashboard and login

`GET /` is a force-dynamic, administrator-gated dashboard. It renders one card per registered profile plus an add-profile form. Each card shows lifecycle status, a live countdown, account information, token timestamps, scope controls, optional Spotify app credentials, and reauthorize, test-notification, enable/disable, and delete actions. Delete is unavailable for `default`.

`GET /login` renders without a session. Its server action:

- Uses fixed 15-minute counters at `login:fail:<ip>` and `login:fail:global`.
- Rejects requests at 10 per-IP failures or 50 global failures, even if the supplied password is correct.
- Compares the password with `ADMIN_PASSWORD` in constant time.
- Increments both counters after a failed comparison.
- Clears the per-IP counter after an allowed successful comparison.
- Creates a signed, secure, HTTP-only, same-site, 30-day session cookie containing `{iat, gen}`.

Logout increments `session:generation` before deleting the browser cookie, revoking every outstanding administrator session.

## Server actions

- `saveScopes()` whitelists submitted ids against the scope catalog and stores the resulting array.
- `testNotification()` sends the selected profile's current lifecycle state immediately.
- `toggleProfileEnabled()` changes whether the profile can serve tokens or receive scheduled checks.
- `createProfile()` normalizes the submitted id to lowercase, validates it, and registers it.
- `saveProfileCredentials()` requires a client id and either a new secret or an existing encrypted secret. A blank secret preserves the stored value.
- `clearProfileCredentials()` removes both stored values and restores environment fallback.
- `deleteProfile()` removes every owned key and registry entry for a non-default profile.

Every profile-scoped action validates the id, and actions that operate on existing state also confirm registry membership.

## Authentication and crawler rules

`proxy.ts` uses a fail-closed matcher. Exact `/api/token` and `/api/check` requests bypass the administrator session because their handlers apply separate bearer authentication. Similarly prefixed routes do not bypass it. Static assets, image assets, favicon, and `robots.txt` are excluded; `/login` is explicitly allowed.

The proxy checks the cookie signature and age without storage. The dashboard and both Spotify OAuth routes additionally compare the cookie generation against Redis. Every proxy response adds `X-Robots-Tag: noindex, nofollow`.

Crawler protection also includes a disallow-all `robots.ts` response and root metadata with indexing and following disabled. These controls supplement authentication; they do not replace it.

## Notifications

`notify(message, embeds?)` sends a Discord webhook and returns whether Discord accepted it. It logs failures but never throws. `buildStatusEmbed()` creates a Spotify-green embed containing the profile, status, days remaining, expiry timestamp, footer, and event timestamp.

The included Vercel schedule runs `/api/check` at `0 9 * * *`. Self-hosted installations supply their own scheduler. The dashboard's Test Notification action verifies delivery without changing deduplication state.

## Acceptance criteria

1. **Authorization:** Log in, authorize a profile, and return to the dashboard with a new refresh token and `issued_at`. The countdown shows roughly six calendar months.
2. **Consumer API:** A valid bearer request returns only `access_token`, `expires_at`, and `profile`. Missing auth, invalid ids, unknown profiles, and disabled profiles return `401`, `400`, `404`, and `403` respectively.
3. **Cache and refresh:** Repeated requests reuse a valid cached token. Concurrent cache misses normally produce one Spotify refresh call. Refresh-token rotation does not change `issued_at`.
4. **Terminal refresh failure:** An invalid refresh token causes `409 reauth_required` and sets the flag. Later requests return `409` without another Spotify call until reauthorization.
5. **Scopes:** A missing scope record uses `DEFAULT_SCOPES`; a saved empty array requests no optional scopes; saved selections appear on the next Spotify authorization.
6. **Sessions:** Unauthenticated human routes redirect to `/login`. Ten per-IP failures or 50 global failures enforce the lockout window. Logout invalidates previously issued session cookies.
7. **Notifications:** Expiry and reauthorization alerts include the profile and are deduplicated only after successful delivery. A dashboard test sends immediately.
8. **Crawler controls:** `/robots.txt` disallows all and dynamic responses include `X-Robots-Tag: noindex, nofollow`.
9. **Storage parity:** Both adapters encode values consistently and preserve atomic counters and owner-checked locks.
10. **Quality gates:** `pnpm typecheck`, `pnpm lint`, and `pnpm build` complete without errors.
