# ReTokenD contributor guide

This is the working guide for anyone—human or agent—changing ReTokenD. It covers the rules and patterns that matter during implementation. For setup and deployment, use [README.md](README.md); for design rationale, use [ARCHITECTURE.md](ARCHITECTURE.md).

## Start here

Read these files before changing code:

1. [CLAUDE.md](CLAUDE.md) for the non-negotiable project rules.
2. [ARCHITECTURE.md](ARCHITECTURE.md) for system boundaries and request flows.
3. [BUILD_SPEC.md](BUILD_SPEC.md) for the as-built behavioral contract.
4. This guide for day-to-day implementation conventions.

ReTokenD is a private, single-admin Spotify token manager. It stores refresh tokens for one or more profiles and gives trusted projects short-lived access tokens. Reauthorizing a profile repairs every consumer of that profile.

## Rules that must survive every change

- Keep secrets in environment variables or Redis. Never hardcode or commit Spotify credentials, admin credentials, bearer secrets, signing keys, or encryption keys.
- `/api/token` returns access tokens only. A refresh token must never leave the server.
- Set `refresh_token:issued_at` only in `/api/callback`, after a complete authorization returns a valid refresh token. A routine refresh must not change it.
- Treat Spotify's `invalid_grant` as terminal for the current authorization. Set `reauth_required`, return `409`, and make no further refresh attempts until a human reauthorizes.
- Use `constantTimeEquals()` and `bearerMatches()` from `lib/auth.ts` for password and bearer-secret checks. Session and OAuth-state integrity use Web Crypto HMAC helpers from `lib/session.ts`.
- Keep new human-facing behavior behind the admin session. Give new machine-facing endpoints their own explicit bearer or cron authentication.
- Preserve the dark-only interface. `<html class="dark">` is intentional; do not add a theme toggle.
- Write terse comments that explain a non-obvious reason. Do not narrate what the code already says.
- Do not commit `.env*` files. Only `.env.example`, with empty values, is tracked.
- Do not commit, push, or rewrite Git history unless the task explicitly asks for it.

## Reuse the existing boundaries

### Authentication and sessions

- `proxy.ts` is fail-closed: all matched dynamic routes require a valid signed session except the exact `/api/token` and `/api/check` paths, which enforce their own bearer secrets. `/login` remains publicly renderable.
- `lib/session.ts` contains storage-free Web Crypto cookie helpers shared with the proxy.
- `lib/session-server.ts` contains the Redis-backed session-generation check used for server-side revocation.
- `lib/auth.ts` and `lib/crypto.ts` are Node-only. Keep them out of `lib/session.ts`.

### Storage and profiles

- Always import `storage` from `@/lib/storage`. Do not call Redis or Upstash directly from feature code.
- The storage adapter is selected lazily: `REDIS_URL` first, then the `KV_REST_API_URL` and `KV_REST_API_TOKEN` pair.
- Use `keysFor(profile)` from `lib/keys.ts` for profile keys. Do not assemble Redis keys in callers.
- Use `lib/profiles.ts` for registry reads, profile creation, deletion, enabled state, and legacy migration.
- Batch independent storage reads with `Promise.all()`.
- Locks must keep their unique owner and use compare-and-delete release semantics.

### Spotify lifecycle

- Use the helpers in `lib/spotify.ts` for credential resolution, scope selection, authorization URLs, token exchange, token refresh, and account lookup.
- Credentials resolve as a complete pair: dashboard values, then profile-specific environment values, then global environment values. Never mix an id from one source with a secret from another.
- A missing scope record uses `DEFAULT_SCOPES`; a stored empty array is a deliberate no-scope selection.
- A successful access-token refresh may replace a rotated refresh token, but only while the caller owns the refresh lock. It must not update `issued_at`.
- Use `lib/lifecycle.ts` for expiry dates, days remaining, and status. Do not duplicate countdown math.

### Dashboard and notifications

- Follow the existing server-action form pattern in `ScopeSettings.tsx`: a `<form action={serverAction}>` with explicit profile and state inputs.
- Validate every profile id with `isValidProfileId()`. When an action requires an existing profile, also call `profileExists()`.
- Use `notify()` and `buildStatusEmbed()` from `lib/notify.ts` for alerts. Notification delivery fails soft by design.
- Keep the Discord deduplication behavior: alert only after successful delivery, and clear markers on reauthorization.
- `default` cannot be deleted.

## Before adding a feature

1. Search for an existing route, action, helper, key, or component that solves part of the problem.
2. Decide which existing trust boundary owns the behavior.
3. Extend the established abstraction instead of adding a second path to Redis, Spotify, authentication, or notification delivery.
4. Keep errors explicit: route handlers should catch, log, and return a meaningful response.
5. Update the relevant documentation when behavior, configuration, or deployment steps change.

## Verification

Run the checks that match the change, then finish with:

```bash
pnpm typecheck
pnpm lint
pnpm build
```

For token-lifecycle work, exercise these flows locally:

1. Log in, reauthorize a profile, and confirm the dashboard shows roughly six calendar months remaining.
2. Call `/api/token` with the bearer secret and confirm the response contains `access_token`, `expires_at`, and `profile`—never a refresh token.
3. Replace a stored refresh token with an invalid value. The first request should return `409 reauth_required`; subsequent requests must not call Spotify.
4. Save scopes, reauthorize, and confirm Spotify receives exactly the saved selection. Test both a missing selection and a saved empty array.
5. Log out and confirm old session cookies no longer open the dashboard.
6. Trigger a test notification and confirm the profile, status, days remaining, and expiry appear correctly.

Useful Redis states for the `default` profile:

- Set `spotify:default:refresh_token:issued_at` near the end of its six-month window to exercise the expiring-soon state and alert thresholds.
- Set `spotify:default:refresh_token` to an invalid value to exercise `invalid_grant` handling.
- Delete `spotify:default:scopes` to exercise `DEFAULT_SCOPES`; store `[]` to exercise the deliberate empty selection.

## Next.js 16 notes

- Next.js 16 uses `proxy.ts` and an exported `proxy()` function instead of the older middleware convention.
- Route handlers that depend on Node APIs declare `runtime = "nodejs"`. Keep shared cookie verification in the Web Crypto-only session module.
- `app/page.tsx` is force-dynamic. Be careful with `Date.now()` in reusable Server Components because render-time calls can trigger lint warnings.
- Apply `next/font` variables to `<html>` and connect them to the CSS theme explicitly.

When a pattern is unclear, trace the nearest working implementation before inventing a new one. ReTokenD is small enough that consistency is usually the safest design decision.
