// Spotify OAuth helpers. Route handlers only (Node runtime).

import { storage } from "@/lib/storage";
import { REDIS_KEYS } from "@/lib/keys";

// The scopes the portfolio actually consumes. Used as the fallback when no
// custom selection has been saved.
export const DEFAULT_SCOPES = [
  "user-top-read",
  "user-read-currently-playing",
  "user-read-recently-played",
] as const;

// Full catalog of standard Spotify scopes, grouped for the settings UI.
// Partner-only Open Access (SOA) / entitlement scopes are intentionally omitted.
// Ref: https://developer.spotify.com/documentation/web-api/concepts/scopes
export interface ScopeGroup {
  group: string;
  scopes: { id: string; label: string }[];
}

export const SPOTIFY_SCOPE_CATALOG: ScopeGroup[] = [
  {
    group: "Listening History",
    scopes: [
      { id: "user-top-read", label: "Read your top artists and tracks" },
      { id: "user-read-recently-played", label: "Read your recently played tracks" },
      { id: "user-read-playback-position", label: "Read your playback position (podcasts)" },
    ],
  },
  {
    group: "Spotify Connect",
    scopes: [
      { id: "user-read-playback-state", label: "Read your player state" },
      { id: "user-modify-playback-state", label: "Control playback on your devices" },
      { id: "user-read-currently-playing", label: "Read your currently playing track" },
    ],
  },
  {
    group: "Playback",
    scopes: [
      { id: "app-remote-control", label: "Remote-control playback" },
      { id: "streaming", label: "Play content in the Web Playback SDK" },
    ],
  },
  {
    group: "Playlists",
    scopes: [
      { id: "playlist-read-private", label: "Read your private playlists" },
      { id: "playlist-read-collaborative", label: "Read your collaborative playlists" },
      { id: "playlist-modify-private", label: "Modify your private playlists" },
      { id: "playlist-modify-public", label: "Modify your public playlists" },
    ],
  },
  {
    group: "Library",
    scopes: [
      { id: "user-library-read", label: "Read your saved tracks and albums" },
      { id: "user-library-modify", label: "Modify your saved tracks and albums" },
    ],
  },
  {
    group: "Follow",
    scopes: [
      { id: "user-follow-read", label: "Read who you follow" },
      { id: "user-follow-modify", label: "Manage who you follow" },
    ],
  },
  {
    group: "Users",
    scopes: [
      { id: "user-read-email", label: "Read your email address" },
      { id: "user-read-private", label: "Read your subscription details" },
    ],
  },
  {
    group: "Images",
    scopes: [{ id: "ugc-image-upload", label: "Upload images (e.g. playlist covers)" }],
  },
];

// Flat set of every valid scope id, for whitelisting saved selections.
export const ALL_SCOPE_IDS: ReadonlySet<string> = new Set(
  SPOTIFY_SCOPE_CATALOG.flatMap((g) => g.scopes.map((s) => s.id))
);

/**
 * Read the scope selection saved by the admin from Redis, falling back to
 * DEFAULT_SCOPES when nothing (or an empty list) is stored.
 */
export async function getConfiguredScopes(): Promise<string[]> {
  const stored = await storage.get<string[]>(REDIS_KEYS.scopes);
  if (Array.isArray(stored) && stored.length > 0) return stored;
  return [...DEFAULT_SCOPES];
}

export const SPOTIFY_AUTHORIZE_URL = "https://accounts.spotify.com/authorize";
export const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";

export function getRedirectUri(): string {
  const baseUrl = process.env.BASE_URL;
  if (!baseUrl) throw new Error("BASE_URL env var is not set");
  return `${baseUrl.replace(/\/$/, "")}/api/callback`;
}

function getBasicAuthHeader(): string {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_SECRET_ID;
  if (!clientId || !clientSecret) {
    throw new Error("SPOTIFY_CLIENT_ID / SPOTIFY_SECRET_ID env vars are not set");
  }
  const encoded = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  return `Basic ${encoded}`;
}

export interface SpotifyTokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
  expires_in: number;
  refresh_token?: string;
}

export interface SpotifyTokenError {
  error: string;
  error_description?: string;
}

/** Read a response body as text and attempt to parse it as JSON, returning null on failure. */
async function parseJsonSafe(res: Response): Promise<unknown | null> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** Exchange an authorization code for tokens during the initial OAuth callback. */
export async function exchangeCodeForTokens(
  code: string
): Promise<SpotifyTokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: getRedirectUri(),
  });

  const res = await fetch(SPOTIFY_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: getBasicAuthHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  const data = await parseJsonSafe(res);

  if (data === null) {
    throw new Error(`Spotify token exchange failed: HTTP ${res.status}`);
  }

  if (!res.ok) {
    const err = data as SpotifyTokenError;
    throw new Error(`Spotify token exchange failed: ${err.error} ${err.error_description ?? ""}`);
  }

  return data as SpotifyTokenResponse;
}

export type RefreshResult =
  | { ok: true; data: SpotifyTokenResponse }
  | { ok: false; invalidGrant: true }
  | { ok: false; invalidGrant: false; error: string };

/** Refresh an access token using a stored refresh token. */
export async function refreshAccessToken(refreshToken: string): Promise<RefreshResult> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  const res = await fetch(SPOTIFY_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: getBasicAuthHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  const data = await parseJsonSafe(res);

  if (!res.ok) {
    if (data === null) {
      return { ok: false, invalidGrant: false, error: `spotify_http_${res.status}` };
    }
    const err = data as SpotifyTokenError;
    if (err.error === "invalid_grant") {
      return { ok: false, invalidGrant: true };
    }
    return { ok: false, invalidGrant: false, error: err.error_description ?? err.error };
  }

  if (data === null) {
    return { ok: false, invalidGrant: false, error: `spotify_http_${res.status}` };
  }

  return { ok: true, data: data as SpotifyTokenResponse };
}

export function buildAuthorizeUrl(state: string, scopes: string[]): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.SPOTIFY_CLIENT_ID ?? "",
    scope: scopes.join(" "),
    redirect_uri: getRedirectUri(),
    state,
    show_dialog: "true",
  });
  return `${SPOTIFY_AUTHORIZE_URL}?${params.toString()}`;
}
