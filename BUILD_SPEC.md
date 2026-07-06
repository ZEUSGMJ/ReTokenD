# ReTokenD — Build Spec

A password-gated Next.js (App Router) app, deployable on Vercel or self-hosted (Docker). It is the **single source of truth** for one or more Spotify refresh tokens ("profiles"), used by my personal portfolio plus other projects.

> **v2 — profiles.** This spec has been updated to match what's actually built: multi-profile support, dual storage backends (Upstash or self-hosted Redis), per-profile Spotify app credentials, and login rate limiting. Historical v1 (single token, Upstash-only) is superseded below.

> **First:** read `CLAUDE.md` for the hard constraints before touching the code.

---

## 1. Why this exists

Starting **July 20, 2026**, Spotify refresh tokens expire **6 months after the original authorization**, and **refreshing does NOT extend that window** (verified against Spotify's docs). On expiry the token endpoint returns `400 {"error":"invalid_grant"}` and the only fix is re-authorizing.

I reuse Spotify refresh tokens across several projects. Without a central token service, consumers of a given token break simultaneously every 6 months and I'd have to paste a new token into every project's env. ReTokenD fixes that:

```
                 (re-auth, ~2x/year, me only, password-gated)
   me ─▶ dashboard ─▶ Spotify OAuth ─▶ store refresh_token + issued_at ─▶ Redis/Upstash
                                                       │
   GET /api/token?profile=x ── refresh + cache access token ───┘
        ▲         ▲         ▲
        │ bearer  │ secret  │
   portfolio  project2  project3   (hold only the ReTokenD URL + shared secret)
```

Only ReTokenD ever calls Spotify's refresh endpoint → no token-rotation races. Re-auth once per profile → all consumers of that profile recover automatically. Multiple Spotify accounts/apps are supported as independent **profiles**, each with its own token, scopes, credentials, and countdown.

---

## 2. Tech

- **Next.js 16 (App Router)**, deployable on **Vercel (serverless)** or **self-hosted via Docker** (`output: "standalone"`) — same codebase, chosen purely by env.
- **Storage:** a backend-agnostic `StorageAdapter` (`lib/storage/`), selected lazily at runtime:
  - `REDIS_URL` set → self-hosted Redis via `redis` (node-redis), one persistent TCP connection.
  - else `KV_REST_API_URL` + `KV_REST_API_TOKEN` set → Upstash REST via `@upstash/redis`, constructed explicitly (`automaticDeserialization: false`, so the storage layer owns JSON encode/decode and stays byte-for-byte identical to the node-redis backend), not `fromEnv()` (which doesn't read Vercel Marketplace vars).
  - neither set → throws.
- **Styling:** Tailwind CSS v4 + shadcn/ui (card, button, badge).
- **Fonts:** Inter (UI text), JetBrains Mono (countdown digits).
- **Theme:** Dark mode only (no toggle); `<html class="dark">`.
- No database other than Redis/Upstash. No user accounts beyond the single admin password. Login is rate limited (10 failed attempts / 15 min / IP).

---

## 3. Environment variables

| Var | Purpose |
|-----|---------|
| `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` | Default Spotify app credentials, used by any profile without its own |
| `SPOTIFY_CLIENT_ID_<PROFILE>` / `SPOTIFY_CLIENT_SECRET_<PROFILE>` | Optional per-profile override (suffix = profile id upper-cased, `-`→`_`); dashboard-entered credentials take precedence over these |
| `RETOKEND_SECRET` | Bearer secret the consumer projects send to `/api/token` |
| `ADMIN_PASSWORD` | Gates dashboard + `/login` + `/api/login` + `/api/callback` |
| `SESSION_SECRET` | Signs the admin session cookie and the OAuth-state cookie; fallback key for `CREDENTIALS_SECRET` |
| `CREDENTIALS_SECRET` | Optional. Dedicated key for AES-256-GCM-encrypting per-profile client secrets stored via the dashboard; falls back to `SESSION_SECRET` |
| `BASE_URL` | Public ReTokenD URL, e.g. `https://retokend.example.com` (used to build the OAuth redirect URI) |
| `REDIS_URL` | Self-hosted Redis connection string. Set this **or** the two Upstash vars below (REDIS_URL wins if both are set) |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | Upstash, injected by the Vercel Marketplace integration |
| `CRON_SECRET` | Validates the cron request to `/api/check` (Vercel Cron or an external scheduler) |
| `DISCORD_WEBHOOK_URL` | Discord webhook URL for notifications (private channel) |

Provide a `.env.example` listing all of these (no values). Never commit real values.

---

## 4. Redis keys

Every profile (`default`, `portfolio`, …) gets its own key set under `spotify:<profile>:*`, built by `keysFor(profile)` in `lib/keys.ts`:

| Key (under `spotify:<profile>:`) | Value | Notes |
|-----|-------|-------|
| `refresh_token` | string | The live refresh token. Updated on re-auth and on rotation. |
| `refresh_token:issued_at` | ISO 8601 string | **Set only on full re-auth** (`/api/callback`). Drives the countdown. Never updated on refresh. |
| `access_token` | JSON `{access_token, expires_at}` | Cached token blob (`expires_at` = epoch ms). TTL = `expires_in - 60` (min 60s); `expires_at` is authoritative and a value at/after it is a cache miss. |
| `reauth_required` | "1" / flag | Set when a refresh returns `invalid_grant`. Cleared on successful re-auth. |
| `last_refresh` | ISO 8601 string | Last successful access-token refresh time. Set on every `/api/token` success; displayed on dashboard. |
| `scopes` | JSON array of strings | Admin-selected scope ids, e.g. `["user-top-read","user-read-currently-playing"]`. Persisted by the dashboard; applied on next re-auth. |
| `refresh_lock` | "1" / flag | Short-lived (10s TTL) NX lock for single-flight refresh: only one `/api/token` call hits Spotify at a time; others poll the cache or fall back to refresh. |
| `enabled` | "0" / absent | "0" disables the profile; skipped by `/api/token` (403) and by the cron. Absent/anything else = enabled. |
| `account_id` / `display_name` | string | Best-effort Spotify account metadata fetched on callback, shown on the profile card. |
| `client_id` / `client_secret_enc` | string | Optional per-profile Spotify app credentials entered on the dashboard; secret is AES-256-GCM encrypted (`lib/crypto.ts`). |
| `notified:reauth` | "1" / flag | De-dupe marker for the re-auth alert. Cleared on re-auth. |
| `notified:{days}` | "1" | De-dupe marker so each expiry threshold alert (14/7/1) fires once per cycle. Cleared on re-auth. |

Non-profile keys: `spotify:profiles` (the registry — a JSON array of profile ids, the source of truth for which profiles exist, `lib/profiles.ts`) and `session:generation` (a monotonic counter embedded in every session cookie; `logout()` bumps it to revoke all outstanding cookies server-side). Bare (non-namespaced) keys like `spotify:refresh_token` are **legacy** — they exist only as one-time migration input, read once to seed the `default` profile on first use, and are never written to afterward.

---

## 5. Spotify scopes (configurable)

**Default scopes** (used as fallback if a profile has none saved):
```
user-top-read
user-read-currently-playing
user-read-recently-played
```

**Configurable:** the admin can select any subset of standard user scopes from a grouped UI on the dashboard, per profile (Listening History, Spotify Connect, Playback, Playlists, Library, Follow, Users, Images; partner-only SOA scopes omitted). Selections persist to Redis (`spotify:<profile>:scopes`) and are **applied on the next re-authorization** — Spotify grants scopes at the `authorize` step, not retroactively.

---

## 6. Routes & behavior

### `GET /api/login?profile=x` — (admin-gated)
- Validate `profile` (defaults to `default`) against the id pattern; `400 invalid_profile` otherwise.
- Generate a random `state`; store `{state, profile, iat}` HMAC-signed in a short-lived cookie (`retokend_oauth_state`, 10-min TTL).
- Redirect to `https://accounts.spotify.com/authorize` with:
  `response_type=code`, `client_id` (resolved per profile), `scope` (space-joined, per-profile configured scopes), `redirect_uri=${BASE_URL}/api/callback`, `state`, `show_dialog=true`.

### `GET /api/callback` — (admin-gated)
- Verify the signed state cookie: signature valid, not expired, `state` matches the query param. Recover `profile` from the cookie payload — the profile travels in the cookie, not the URL, so one registered redirect URI serves every profile.
- Exchange `code` for tokens: `POST https://accounts.spotify.com/api/token`
  - Headers: `Authorization: Basic base64(client_id:client_secret)` (profile's resolved credentials), `Content-Type: application/x-www-form-urlencoded`
  - Body: `grant_type=authorization_code`, `code`, `redirect_uri=${BASE_URL}/api/callback`
- Validate the response includes a non-empty `refresh_token` string; if not, show an error page and make **no** writes (never reset `issued_at` without a token to store).
- On success: store `spotify:<profile>:refresh_token`, set `spotify:<profile>:refresh_token:issued_at = now (ISO)` (**the only place this happens**), delete `access_token`, `reauth_required`, `notified:reauth`, and all `notified:*` threshold flags. Best-effort fetch the Spotify account (`/v1/me`) and store `account_id`/`display_name` for the dashboard card. Register the profile in `spotify:profiles`. Redirect to `/`.
- On error (missing code/state, invalid/expired state, exchange failure): show a clear error page.

### `GET /api/token?profile=x` — (bearer-gated, for consumer projects)
- Require header `Authorization: Bearer ${RETOKEND_SECRET}`; else `401 unauthorized`.
- Validate `profile` (defaults to `default`): invalid id → `400 invalid_profile`; not registered → `404 unknown_profile`; disabled → `403 profile_disabled`.
- The registry, `enabled` flag, and cached token are read in parallel; the 404/403 branches preserve their ordering. If the cached `{access_token, expires_at}` blob is present and unexpired → return `{ access_token, expires_at, profile }` immediately.
- If no refresh token stored, **or** `reauth_required` is set → `409 { error: "reauth_required", profile }` **without calling Spotify** (no retries after `invalid_grant` until re-auth clears the flag).
- Else: acquire `refresh_lock` (10s NX lock). Losers poll the access-token cache (4 iterations × 500ms); if still nothing, a loser **re-reads `refresh_token` + `reauth_required`** (409 if now flagged/absent) before falling back to a normal refresh with the fresh token as a safety valve.
- Winner: read `refresh_token` and refresh:
  - `POST https://accounts.spotify.com/api/token`, `Authorization: Basic base64(id:secret)`, body `grant_type=refresh_token`, `refresh_token`.
  - On `200`: cache `access_token` as `{access_token, expires_at}` (TTL `expires_in - 60`, min 60s), set `last_refresh = now`, clear `reauth_required`; if the response **includes a new `refresh_token`**, overwrite `refresh_token` **only while holding the lock** (a loser must not clobber the winner's rotation) but **DO NOT touch `issued_at`**. Return `{ access_token, expires_at, profile }`.
  - On `400 invalid_grant`: set `reauth_required`, **do not retry**, return `409 { error: "reauth_required", profile }`.
  - Other Spotify errors: `502 { error: "spotify_error" }`.
- **Never** include the refresh token in any response.

### `GET /` — dashboard (admin-gated)
- **Header bar:** app title on the left; **Log out** button on the right.
- **One `ProfileCard` per registered profile:** status badge (valid / expiring-soon / expired-or-reauth-required), a **live countdown** to `issued_at + 6 months`, account info (display name / id), token details (issued-at, expires-at, last refresh), scopes (grouped checkboxes, **Save scopes** — applied on next re-auth), Spotify app credentials (client id/secret, encrypted at rest), **Re-authorize** button (`/api/login?profile=x`), **Test Notification**, enable/disable toggle, and (for non-`default` profiles) **Delete**.
- **Add profile** form/card: creates and registers a new profile id.

### `GET /login` + `POST /login` (server action) — admin password page
- Simple password form. Rate limited atomically (`storage.incr`, window preserved): per client IP in Redis (`login:fail:<ip>`, 15-min window) at 10 failures, plus a global `login:fail:global` at 50/15-min so a spoofed `X-Forwarded-For` can't buy unlimited guesses; at the limit further attempts (even correct ones) are rejected until the window expires. A successful login clears the per-IP counter.
- Constant-time compare against `ADMIN_PASSWORD`; on success set a signed session cookie (`retokend_session`, `SESSION_SECRET`, 30-day TTL) embedding the current `session:generation`; redirect to `/`. `logout()` bumps `session:generation` to revoke every outstanding cookie server-side.

### `GET /api/check` — cron (secret-gated)
- Validate the request (`Authorization: Bearer ${CRON_SECRET}`).
- Iterate every **enabled** profile. For each: if `reauth_required`, send one Discord alert (deduped via `notified:reauth`); else compute days-left from `issued_at` and, if `<=` the smallest un-notified threshold (ascending 1/7/14), send a notification — only one threshold fires per run per profile. `notify()` returns whether delivery succeeded; the dedupe flag is set **only on success** (a Discord outage retries next run), and when a threshold fires the flags for all larger thresholds are set too (implied), so no stale follow-up alerts.

---

## 7. Auth gate (proxy)

`proxy.ts` (Next.js 16 replaces the `middleware.ts` convention with `proxy`) is **fail-closed**: an inverted matcher protects every route *except* `api/token`, `api/check`, and static assets (`_next/static`, `_next/image`, `favicon.ico`, `robots.txt`, `.svg/.png/.ico`), so any new route is session-gated by default. It verifies the signed session cookie's **signature + age only** (Edge, storage-free); `/login` and `/robots.txt` skip the check so the login form renders unauthenticated.
**Excluded:** `/api/token` (bearer secret) and `/api/check` (cron secret).
The server-side **generation check** (revocation) runs Node-side at the top of `/`, `/api/login`, and `/api/callback`. Also adds `X-Robots-Tag: noindex, nofollow` to all responses.

---

## 8. Hidden from search engines

- `app/robots.ts` → disallow all (`{ rules: { userAgent: '*', disallow: '/' } }`).
- Root `metadata.robots = { index: false, follow: false }`.
- `X-Robots-Tag: noindex, nofollow` response header (middleware or `next.config` headers).
- The admin password gate already blocks crawlers from content.
- Optional: enable Vercel Deployment Protection (Vercel Authentication) for an extra layer.

---

## 9. Notifications (Discord webhook)

A cron entry (`vercel.json` on Vercel, or an external scheduler for self-hosted) hits `/api/check` daily (e.g., `0 9 * * *`). For each **enabled** profile, on threshold crossing (14/7/1 days remaining) or `reauth_required`, sends a Discord webhook message.

**Channel:** Discord webhook to a private channel (env var `DISCORD_WEBHOOK_URL`). No bot, no hosting; one stateless `fetch` per notification. Enabled mobile push by toggling channel notifications on Discord.

**Format:** Rich embeds via `buildStatusEmbed()` — title "ReTokenD" (or "ReTokenD — `<profile>`" when a profile is given), description, Spotify green color #1DB954, fields: Profile, Status, Days Remaining, Expires At with Discord epoch timestamp, footer, ISO timestamp. Abstracted behind `notify(message, embeds?)` in `lib/notify.ts` (fails soft, never throws) so the channel is swappable to ntfy/Telegram/email/etc. later.

**Test:** The dashboard **Test Notification** button on each profile card sends a sample embed with that profile's current token state immediately, useful for verifying the webhook is wired correctly without waiting for a real threshold.

---

## 10. Spotify app config (I do this manually)

Add `${BASE_URL}/api/callback` (and a `http://127.0.0.1:3000/api/callback` for local dev) as Redirect URIs on the **PROD** Spotify app at the Spotify Developer Dashboard. The DEV app stays for portfolio localhost dev.

---

## 11. Security checklist

- Secrets only in env/Redis; provide `.env.example` with empty values; `.gitignore` covers `.env*`.
- `/api/token` returns access token only — never refresh token.
- Constant-time compare for `ADMIN_PASSWORD` and `RETOKEND_SECRET` checks.
- Login rate limited (10 failures / 15 min / IP).
- Per-profile client secrets encrypted at rest (AES-256-GCM, `CREDENTIALS_SECRET`/`SESSION_SECRET`).
- Signed, httpOnly, secure session and OAuth-state cookies.
- Validate OAuth `state`.
- The repo is public — secrets live only in env/Redis; never in code or committed files.

---

## 12. Verification (do before declaring done)

1. **Re-auth:** `/login` → dashboard → Re-authorize a profile → approve on Spotify → redirected back; countdown shows ~6 months; `spotify:<profile>:refresh_token` + `issued_at` exist in the storage backend.
2. **Token endpoint:** `curl -H "Authorization: Bearer $RETOKEND_SECRET" $BASE_URL/api/token` → `{access_token, expires_at, profile}`; missing/wrong header → `401`; unknown profile → `404`; disabled profile → `403`.
3. **invalid_grant:** set a garbage `spotify:<profile>:refresh_token` → `/api/token` → `409 reauth_required`, flag set, no retry (no Spotify call on subsequent requests); dashboard shows expired/re-auth state.
4. **Gating:** hitting `/` or `/api/login` without the session cookie redirects to `/login`; `/api/token` is reachable with the bearer secret only.
5. **Login rate limit:** 10 wrong-password submissions from one IP within 15 minutes lock out further attempts until the window expires or a correct login (which clears the counter).
6. **No-index:** `curl -I $BASE_URL` shows `X-Robots-Tag: noindex`; `/robots.txt` disallows all.
7. **Cron:** hitting `/api/check` with the cron secret triggers a test notification for a profile within a threshold or with `reauth_required` set.

---

## 13. After it's live

Tell me the deployed `BASE_URL` and confirm `/api/token` works. Then I return to my **portfolio** session and switch its `lib/utils/spotify.js` to fetch from `${RETOKEND_URL}/api/token` with the bearer secret, and remove the old `SPOTIFY_REFRESH_TOKEN`/`SPOTIFY_CLIENT_SECRET` usage there. The other two projects get the same consumer change.
