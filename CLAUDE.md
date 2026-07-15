# ReTokenD project guide

ReTokenD is a private, single-admin Spotify token manager. It stores refresh tokens for one or more profiles, gives trusted projects short-lived access tokens, tracks each six-month authorization window, and centralizes reauthorization.

## Commands

- `pnpm dev` — start the local development server
- `pnpm build` — create a production build
- `pnpm lint` — run ESLint
- `pnpm typecheck` — run TypeScript without emitting files

## Non-negotiable rules

- Keep secrets in environment variables or Redis. Never hardcode or commit them.
- `/api/token` may return an access token, but never a refresh token.
- Set `issued_at` only after a full authorization succeeds in `/api/callback`. A normal token refresh must never change it because Spotify does not extend the six-month lifetime on refresh.
- When Spotify returns `invalid_grant`, do not retry. Mark the profile as requiring reauthorization and return `409`.
- Keep every human-facing route password-gated and hidden from search engines.
- Use the existing authentication, storage, profile, lifecycle, and notification helpers instead of creating parallel implementations.

## Documentation map

- [README.md](README.md) — setup, deployment, configuration, and API usage
- [ARCHITECTURE.md](ARCHITECTURE.md) — system design, trust boundaries, storage, profiles, and request flows
- [BUILD_SPEC.md](BUILD_SPEC.md) — as-built behavior and acceptance criteria
- [AGENTS.md](AGENTS.md) — contributor workflow, project conventions, and verification

Spotify introduced a six-month lifetime for refresh tokens in 2026. Refreshing an access token does not restart that clock, so ReTokenD records the original authorization time and provides one place to reauthorize every consumer of a profile.
