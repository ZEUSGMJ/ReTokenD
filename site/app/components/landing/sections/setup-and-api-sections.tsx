import { Link2, ListChecks, Lock } from "lucide-react";
import { CodeFrame } from "../ui/code-frame";
import { ExternalLink } from "../ui/external-link";
import { GITHUB_URL } from "../content";

const redirectUris = `https://<your-domain>/api/callback
http://127.0.0.1:3000/api/callback`;

const dockerCommands = `git clone ${GITHUB_URL}.git
cd ReTokenD
cp .env.example .env
docker compose up --build`;

const vercelSteps = `1. import the repo on vercel
2. install the upstash integration (marketplace)
3. set the env vars below
4. deploy`;

const environmentVariables = `# Spotify app credentials.
SPOTIFY_CLIENT_ID=…
SPOTIFY_CLIENT_SECRET=…

# Dashboard login and session signing.
ADMIN_PASSWORD=…
SESSION_SECRET=…

# Bearer secrets for /api/token and /api/check.
RETOKEND_SECRET=…
CRON_SECRET=…

# Public OAuth callback origin and self-hosted storage.
BASE_URL=…
REDIS_URL=…

# Optional notifications and credential encryption.
DISCORD_WEBHOOK_URL=…
CREDENTIALS_SECRET=…

# Optional profile-specific Spotify credentials.
SPOTIFY_CLIENT_ID_PORTFOLIO=…
SPOTIFY_CLIENT_SECRET_PORTFOLIO=…

# Vercel + Upstash: leave REDIS_URL unset and use these instead.
KV_REST_API_URL=…
KV_REST_API_TOKEN=…`;

const tokenRequest = `curl -H "Authorization: Bearer $RETOKEND_SECRET" ${"\\"}
  "https://<retokend>/api/token?profile=portfolio"`;

const tokenResponse = `{
  "access_token": "BQDe3f…",
  "expires_at": 1750000000000,
  "profile": "portfolio"
}`;

function SetupSection() {
  return (
    <section id="setup" className="mx-auto max-w-6xl border-x border-b border-rule px-5 pb-20 pt-4">
      <h2 className="font-display text-2xl font-semibold text-ink">Running it</h2>
      <p className="mt-4 text-lg leading-relaxed text-ink-2">
        Create an app in the{" "}
        <ExternalLink
          href="https://developer.spotify.com/"
          icon={false}
          className="text-ink underline decoration-accent decoration-1 underline-offset-2 hover:text-accent"
        >
          Spotify Developer Dashboard
        </ExternalLink>{" "}
        and register both redirect URIs. Every profile uses the same callback. Then choose Docker
        with Redis or Vercel with Upstash.
      </p>

      <div className="mt-10 flex flex-col gap-10">
        <CodeFrame
          label="Spotify redirect URIs"
          language="text"
          code={redirectUris}
          icon={Link2}
          notes={["Spotify permits plain HTTP only on the 127.0.0.1 loopback, not localhost."]}
        />

        <div className="grid items-start gap-8 lg:grid-cols-2">
          <CodeFrame
            label="Docker + Redis"
            language="shellscript"
            code={dockerCommands}
            notes={[
              "Compose supplies the app’s internal REDIS_URL.",
              "The app runs on :3000 with Redis on a persistent volume.",
              "Also runs on any platform that can run its Docker image and connect to Redis.",
            ]}
          />

          <CodeFrame
            label="Vercel + Upstash"
            language="text"
            code={vercelSteps}
            icon={ListChecks}
            copyable={false}
            notes={[
              "Leave REDIS_URL unset; Upstash is auto-detected.",
              "Vercel picks up the daily /api/check cron automatically.",
            ]}
          />
        </div>

        <CodeFrame
          label="Environment variables"
          language="dotenv"
          code={environmentVariables}
        />
      </div>
    </section>
  );
}

function ApiSection() {
  return (
    <section id="api" className="mx-auto flex max-w-6xl flex-col border-x border-rule px-5 pb-20 pt-16">
      <h2 className="mb-8 font-display text-2xl font-semibold text-ink">The token endpoint</h2>

      <div className="grid items-start gap-8 lg:grid-cols-2">
        <CodeFrame
          label="Request"
          language="shellscript"
          code={tokenRequest}
          notes={[
            "400 invalid profile · 401 bad bearer · 403 profile disabled · 404 unknown profile · 409 reauth required · 502 Spotify error",
          ]}
        />

        <CodeFrame label="Response · 200" language="json" code={tokenResponse} />
      </div>

      <div className="mt-10 max-w-[65ch] self-center rounded-card border border-rule bg-paper-2 p-5">
        <div className="flex items-start gap-2.5 text-sm leading-relaxed text-ink-2">
          <Lock aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-accent" />
          <div className="flex flex-col gap-1">
            <span className="font-semibold text-ink">The refresh token is never returned.</span>
            <span>It stays on the server. Consumers only receive short-lived access tokens.</span>
            <span>
              Per-profile Spotify app credentials are optional; complete pairs override the shared
              app.
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

export function SetupAndApiSections() {
  return (
    <>
      <SetupSection />
      <ApiSection />
    </>
  );
}
