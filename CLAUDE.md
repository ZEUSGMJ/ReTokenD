# ReTokenD — project guide

**ReTokenD** is a personal, private, password-gated Next.js app that owns Spotify refresh tokens for one or more accounts ("profiles"), hands short-lived access tokens to my other projects, shows a countdown to each token's 6-month expiry, and lets me re-authorize with one click.

## Commands

- `pnpm dev` — local dev server
- `pnpm build` — production build
- `pnpm lint` — eslint
- `pnpm typecheck` — `tsc --noEmit`

## Hard constraints (do not deviate without asking)

- **Secrets only in env / Redis — never in code or committed files.**
- The `/api/token` endpoint must return **only** an access token, **never** the refresh token.
- The `issued_at` timestamp (countdown source) is reset **only** on full re-authorization via `/api/callback`, **never** on a normal token refresh — Spotify does not extend the 6-month window on refresh.
- On `invalid_grant` from Spotify: **do not retry**; flag for re-auth.
- The app must be **hidden from search engines** and **password-gated** for all human-facing routes.

## Where to look

- **[ARCHITECTURE.md](ARCHITECTURE.md)** — how the app is put together (layout, storage abstraction, profiles, request flows, secrets model, deployment modes).
- **[README.md](README.md)** — setup, env vars, deployment (Docker or Vercel), consumer usage.

## Context

Spotify refresh tokens expire 6 months after authorization starting July 20, 2026 (and refreshing does NOT extend that window). ReTokenD centralizes the token(s) so re-auth is a single click that heals all consuming projects at once, instead of editing the token in multiple project envs.
