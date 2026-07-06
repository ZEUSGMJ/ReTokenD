# Agents: SOP for ReTokenD

This document is a quickstart for anyone (human or agent) picking up work on this project.

## What this project is

**ReTokenD**, a single-admin Spotify token manager — a Next.js app, backed by Redis (self-host) or Upstash (Vercel), that owns Spotify refresh tokens for one or more accounts ("profiles"), hands short-lived access tokens to other projects, and handles re-authorization centrally. Re-auth once per profile, all consumers of that profile recover automatically.

See `CLAUDE.md` for the problem statement and hard constraints, and `BUILD_SPEC.md` for the full technical spec.

## Before you touch the code

**Read these in order:**
1. `CLAUDE.md` — hard constraints and project rules (non-negotiable).
2. `ARCHITECTURE.md` — how the app is structured (layout, storage, profiles, request flows).
3. `BUILD_SPEC.md` — the spec reflecting what was actually built.
4. This file.

## Golden rules (do not deviate)

- **Secrets only in env / Redis.** Never hardcode or commit `SPOTIFY_SECRET_ID`, `ADMIN_PASSWORD`, `RETOKEND_SECRET`, `SESSION_SECRET`, `CREDENTIALS_SECRET`, etc. `.env.example` lists all vars (empty values only); `.gitignore` covers `.env*`.
- **`/api/token` returns access token ONLY.** Never leak the refresh token to consumers.
- **`issued_at` is sacred.** Set **only** in `/api/callback` on full re-auth; never touched on a normal token refresh. Spotify doesn't extend the 6-month window on refresh, so tampering with `issued_at` breaks the countdown.
- **On `invalid_grant` from Spotify: no retry.** Set the profile's `reauth_required` flag and return `409`. This signals to the consumer and dashboard that re-auth is needed.
- **Constant-time compares for bearer/session auth.** `constantTimeEquals()` / `bearerMatches()` in `lib/auth.ts` (Node-only, `node:crypto`). Session/OAuth-state cookie signing uses Web Crypto HMAC (Edge-safe, `lib/session.ts`).
- **Terse developer comments only.** Comments explain non-obvious "why," not "what." Never add descriptive/narrative comments — match the existing style.
- **Dark mode only.** No theme toggle. `<html class="dark">` is baked in.
- **Never commit `.env*` files.** The repo is public; OAuth secrets are in plaintext in `.env.local` during dev, and `.gitignore` covers `.env*` (only `.env.example` is tracked).

## Architecture highlights

### Middleware / Proxy
- File: `proxy.ts` (Next.js 16 renamed `middleware.ts` convention).
- Protects: `/`, `/login` (allow GET), `/api/login`, `/api/callback`. Excluded: `/api/token`, `/api/check` (each has its own bearer auth).
- Adds `X-Robots-Tag: noindex, nofollow` to all responses.

### Session / OAuth state
- File: `lib/session.ts` — Web Crypto HMAC-SHA256 (Edge-safe). No `jsonwebtoken`.
- Cookie format: `base64url(payload).base64url(HMAC)`.
- Cookies: `retokend_session` (30-day TTL), `retokend_oauth_state` (10-min TTL, carries the signed `{state, profile, iat}` payload).

### Storage
- Directory: `lib/storage/` — `index.ts` selects the adapter lazily on first use (not at import time, so `next build` without secrets doesn't throw). Precedence: `REDIS_URL` → `node-redis.ts` adapter; else `KV_REST_API_URL` + `KV_REST_API_TOKEN` → `upstash.ts` (REST) adapter; else throw.
- Both adapters implement the same `StorageAdapter` interface (`get/set/setWithTTL/del/exists/ttl/acquireLock`) and JSON-encode values identically, so callers never know which backend is live.
- Always import `storage` from `@/lib/storage`.

### Redis keys
- File: `lib/keys.ts` — all key names centralized. `keysFor(profile)` returns the per-profile key set under `spotify:<profile>:*`: `refresh_token`, `refresh_token:issued_at`, `access_token`, `reauth_required`, `last_refresh`, `scopes`, `refresh_lock`, `enabled`, `account_id`, `display_name`, `client_id`, `client_secret_enc`, `notified:reauth`, `notified:{14|7|1}`.
- Registry: `spotify:profiles` (JSON array of profile ids) — the source of truth for which profiles exist, managed by `lib/profiles.ts`.
- `LEGACY_KEYS` (bare `spotify:refresh_token`, etc., no profile segment) exist only as one-time migration input — read once by `ensureInitialized()` to seed the `default` profile on first use, never written to afterward.

### Spotify OAuth & token refresh
- File: `lib/spotify.ts` — constants, scope catalog, `DEFAULT_SCOPES`, `getConfiguredScopes()`, `buildAuthorizeUrl()`, `exchangeCodeForTokens()`, `refreshAccessToken()`, `fetchSpotifyProfile()`.
- Scopes: `DEFAULT_SCOPES` (3 baseline scopes) + `SPOTIFY_SCOPE_CATALOG` (all standard user scopes, grouped, no partner-only SOA). Configurable per profile from the dashboard; applied on the **next** re-auth.
- Credentials resolve per profile in this order (`credentialsFor()`): dashboard-entered creds in Redis (secret AES-256-GCM decrypted via `lib/crypto.ts`) → `SPOTIFY_CLIENT_ID_<PROFILE>`/`SPOTIFY_SECRET_ID_<PROFILE>` env pair → global `SPOTIFY_CLIENT_ID`/`SPOTIFY_SECRET_ID`. Always resolved as a coherent pair, never mixed.

### Token refresh endpoint (`/api/token`)
- Takes `?profile=` (defaults to `default`). Validates the id (`400 invalid_profile`), that it's registered (`404 unknown_profile`), and that it's enabled (`403 profile_disabled`).
- Cached-token fast path: returns immediately if an access token is cached.
- Reauth fast path: if the `reauth_required` flag is set (or no refresh token stored), returns `409 { error: "reauth_required" }` **without calling Spotify** — no retries after `invalid_grant` until re-auth clears the flag.
- Single-flight lock (`refresh_lock`, 10s TTL, NX) prevents concurrent Spotify hits. Losers poll the access-token cache 10× at 200ms intervals, then fall back to a normal refresh if it's still not cached.
- On `200`: cache token (TTL `expires_in - 60`, min 60s), update `last_refresh`, clear `reauth_required`. Overwrite the refresh token **if** Spotify returns a new one (token rotation), but **never touch `issued_at`**.
- On `invalid_grant`: set `reauth_required`, return `409`.

### Dashboard
- Server component (`app/page.tsx`), reads Redis, renders one `ProfileCard` per registered profile plus an "Add profile" form.
- `app/components/ProfileCard.tsx` — status/countdown, account info, scopes, credentials form, re-auth/disable/delete actions.
- `app/components/AddProfileForm.tsx`, `Countdown.tsx` (client, ticks every 1s), `StatusBadge.tsx` (valid / expiring-soon / expired-or-reauth-required), `ScopeSettings.tsx` (grouped checkboxes, Save button), `ProfileCredentialsForm.tsx` (per-profile Spotify client id/secret, encrypted at rest), `DeleteProfileButton.tsx`, plus `components/ui/` (shadcn primitives: card, button, badge).

### Notifications
- File: `lib/notify.ts` — `notify(message, embeds?)` abstracts the channel; fails soft (logs, never throws). `buildStatusEmbed({...profile})` builds a rich embed labeled per profile (title `ReTokenD — <profile>`).
- Current: Discord webhook (`DISCORD_WEBHOOK_URL`) with rich embeds (Spotify green `#1DB954`, fields, Discord epoch timestamps).
- Cron: `/api/check`, runs daily (`vercel.json`: `0 9 * * *`), iterates every **enabled** profile, checks the re-auth flag (deduped via `notified:reauth`) and expiry thresholds (14/7/1 days, fires only the smallest un-notified threshold per run), sends alerts, sets de-dupe markers.
- Test: Dashboard **Test Notification** button sends a sample embed immediately.

### Server actions
- File: `app/actions.ts` — `logout()`, `saveScopes()`, `testNotification()`, `toggleProfileEnabled()`, `createProfile()`, `saveProfileCredentials()`, `deleteProfile()`, `clearProfileCredentials()`.
- All `"use server"`; every profile-scoped action validates `isValidProfileId()` and (where the profile must already exist) `profileExists()`. `deleteProfile()` refuses to delete `default`.
- Middleware-gated (they POST to `/`, which the proxy covers) — except `/api/token` and `/api/check`, which have their own bearer/cron auth.

## Common patterns to reuse

- **Bearer auth check:** `bearerMatches(authHeader, secret)` from `lib/auth.ts` — used in `app/api/token/route.ts` and `app/api/check/route.ts`.
- **Server actions form submission:** see `ScopeSettings.tsx` — `<form action={serverAction}>` with hidden inputs for profile/state.
- **Discord embed:** `buildStatusEmbed()` in `lib/notify.ts` — Spotify green color, fields, Discord `<t:EPOCH:F>` timestamp, per-profile title/field.
- **Redis key reads:** use `Promise.all()` to batch reads in server components (`app/page.tsx`) and route handlers.
- **Error handling in routes:** try/catch, log, return error responses. No silent failures.

## Testing locally

1. **Spotify auth works:** Log in → Re-authorize → approve on Spotify → dashboard shows ~179 days (6 months from today) for the profile.
2. **Token endpoint works:** `curl -H "Authorization: Bearer $RETOKEND_SECRET" http://127.0.0.1:3000/api/token` → `{access_token, expires_at, profile}`.
3. **Test notification:** Click **Test Notification** on a profile card → Discord message arrives with status/days-left/expiry.
4. **Logout:** Click **Log out** → redirected to `/login`; visiting `/` without a session cookie redirects back to `/login`.
5. **Scope selection:** Pick scopes → **Save scopes** → Re-auth → Spotify consent screen lists exactly the saved scopes.
6. **Login rate limit:** 10 wrong-password submissions from the same IP within 15 minutes lock out further attempts (even a correct one) until the window expires; a successful login clears the counter.

To fake token states without waiting 6 months, manually edit Redis (default profile shown; substitute `spotify:<profile>:*` for others):
- Set `spotify:default:refresh_token:issued_at` to ~13.5 days ago → dashboard shows "Expiring soon", cron alerts at the 14-day threshold.
- Set `spotify:default:refresh_token` to garbage → `/api/token` returns `409 reauth_required` and sets the flag.
- Clear `spotify:default:scopes` → next re-auth requests `DEFAULT_SCOPES`.

## Deployment checklist

### Vercel + Upstash
- [ ] **Vercel Marketplace Upstash:** install integration so `KV_REST_API_*` are auto-injected.
- [ ] **Env vars in Vercel:** set the required vars in Production + Preview (see `.env.example`); `BASE_URL` = your real deployed domain.
- [ ] **Spotify Developer Dashboard:** add redirect URI `https://<your-retokend-domain>/api/callback`.
- [ ] **Discord webhook:** create a private channel, grab the webhook URL, paste into `DISCORD_WEBHOOK_URL`.
- [ ] **Vercel Cron secret:** set `CRON_SECRET` in Vercel and in the app env so `/api/check` validates. `vercel.json` already schedules the cron.
- [ ] **Verify:** `curl -H "Authorization: Bearer $CRON_SECRET" https://<retokend>/api/check` returns `{ ok: true, notifications: {} }`.

### Docker / self-host
- [ ] Set `REDIS_URL` (compose provides this by default) and the rest of `.env.example`, leaving `KV_REST_API_*` unset.
- [ ] `docker compose up --build` — Redis persists via the `redis_data` named volume (`appendonly`).
- [ ] Set an external scheduler (host cron, cron-job.org, systemd timer, GitHub Actions) to hit `/api/check` with `Authorization: Bearer $CRON_SECRET` daily.
- [ ] Register `<BASE_URL>/api/callback` on the Spotify Developer Dashboard.

### Either path
- [ ] If storing per-profile client secrets from the dashboard, set `CREDENTIALS_SECRET` (or accept the `SESSION_SECRET` fallback).
- [ ] Tell your other projects: ReTokenD's `/api/token` endpoint is live (pass `?profile=<id>` for non-default profiles).

## When adding a new feature

1. **Check if it's already done.** Search the codebase for similar patterns (e.g., server action, Redis key, API route).
2. **Keep it behind the gate.** New human-facing UI goes on the dashboard (admin-gated); new consumer APIs go on `/api` (bearer-gated or gated by `CRON_SECRET`).
3. **Use existing abstractions:** `notify()` / `buildStatusEmbed()` for alerts, `getConfiguredScopes()` for reading settings, `storage` from `lib/storage` for persistence, `keysFor()` from `lib/keys.ts` for key names, `SESSION_COOKIE_NAME` / session helpers from `lib/session.ts`.
4. **Test locally first.** Boot `pnpm dev`, exercise the feature end-to-end (auth, storage reads/writes, notifications).
5. **Build + lint must pass:** `pnpm build && pnpm lint`. No TypeScript errors, no console warnings.
6. **No git operations unless told.** This SOP assumes the repo is already tracked; don't commit/push unless explicitly asked.

## Next.js 16 gotchas

- `middleware.ts` is now `proxy.ts` (function name `proxy` instead of `middleware`).
- Middleware runs on Edge (Web Crypto only); route handlers run on Node (full Node.js API).
- `Date.now()` in a server component render triggers a lint warning if not in a one-off context (e.g., a `force-dynamic` server component is fine, but a Server Component rendered multiple times should not call `Date.now()` in the body).
- `font variables` from `next/font/google` must be explicitly applied to `<html>` and wired in CSS — `--font-sans: var(--font-inter)` in the theme.

## Questions?

Refer to `ARCHITECTURE.md` (how it's built), `BUILD_SPEC.md` (what was built), `CLAUDE.md` (rules), or trace the existing code patterns. Patterns repeat — favor consistency over novelty.
