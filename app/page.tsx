import { storage } from "@/lib/storage";
import { REDIS_KEYS, SIX_MONTHS_MS } from "@/lib/keys";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Countdown } from "@/app/components/Countdown";
import { StatusBadge, type TokenStatus } from "@/app/components/StatusBadge";
import { ScopeSettings } from "@/app/components/ScopeSettings";
import { SPOTIFY_SCOPE_CATALOG, getConfiguredScopes } from "@/lib/spotify";
import { logout, testNotification } from "@/app/actions";

export const dynamic = "force-dynamic";

function formatDate(iso: string | null): string {
  if (!iso) return "Never";
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default async function Dashboard() {
  const [issuedAt, lastRefresh, reauthRequired, configuredScopes] = await Promise.all([
    storage.get<string>(REDIS_KEYS.refreshTokenIssuedAt),
    storage.get<string>(REDIS_KEYS.lastRefresh),
    storage.get<string>(REDIS_KEYS.reauthRequired),
    getConfiguredScopes(),
  ]);

  const expiresAtIso = issuedAt
    ? new Date(new Date(issuedAt).getTime() + SIX_MONTHS_MS).toISOString()
    : null;

  // This is an async, force-dynamic server component that runs once per
  // request, so reading the current time here is intentional and safe.
  // eslint-disable-next-line react-hooks/purity
  const nowMs = Date.now();
  const daysLeft = expiresAtIso
    ? Math.floor((new Date(expiresAtIso).getTime() - nowMs) / (1000 * 60 * 60 * 24))
    : null;

  let status: TokenStatus = "expired-or-reauth-required";
  if (!reauthRequired && issuedAt && daysLeft !== null) {
    if (daysLeft <= 0) {
      status = "expired-or-reauth-required";
    } else if (daysLeft <= 14) {
      status = "expiring-soon";
    } else {
      status = "valid";
    }
  }

  const showWarning = status !== "valid";

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-6">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div className="flex items-center text-2xl font-bold tracking-tight">
          <span className="text-muted-foreground">Re</span>
          <span className="text-foreground">Token</span>
          <span className="text-emerald-500">D</span>
        </div>
        <form action={logout}>
          <Button type="submit" variant="outline" size="sm">
            Log out
          </Button>
        </form>
      </header>

      {/* Hero: status + countdown */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Spotify Token Status</span>
            <StatusBadge status={status} />
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-2 py-6">
          {expiresAtIso ? (
            <Countdown expiresAtIso={expiresAtIso} />
          ) : (
            <span className="font-mono text-3xl font-semibold">No token</span>
          )}
          <p className="text-sm text-muted-foreground">until refresh token expires</p>
          {showWarning && (
            <p className="mt-2 text-sm font-medium text-destructive">
              {reauthRequired
                ? "Spotify rejected the refresh token. Re-authorization is required."
                : !issuedAt
                  ? "No refresh token on file. Re-authorize to get started."
                  : "Token is expiring soon. Re-authorize to avoid an outage."}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Details */}
      <Card>
        <CardHeader>
          <CardTitle>Token Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <div className="text-xs uppercase text-muted-foreground">Issued at</div>
            <div className="text-sm">{formatDate(issuedAt)}</div>
          </div>
          <div>
            <div className="text-xs uppercase text-muted-foreground">Expires at</div>
            <div className="text-sm">{formatDate(expiresAtIso)}</div>
          </div>
          <div>
            <div className="text-xs uppercase text-muted-foreground">
              Last access-token refresh
            </div>
            <div className="text-sm">{formatDate(lastRefresh)}</div>
          </div>
          <div>
            <div className="text-xs uppercase text-muted-foreground">Days left</div>
            <div className="text-sm">{daysLeft !== null ? Math.max(daysLeft, 0) : "—"}</div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Button
            render={<a href="/api/login" />}
            nativeButton={false}
            className="w-full"
            size="lg"
          >
            Re-authorize with Spotify
          </Button>
          <form action={testNotification} className="w-full">
            <input type="hidden" name="status" value={status} />
            <input type="hidden" name="daysLeft" value={daysLeft ?? ""} />
            <input type="hidden" name="expiresAtIso" value={expiresAtIso ?? ""} />
            <Button type="submit" variant="outline" className="w-full" size="sm">
              Test Notification
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Scopes */}
      <Card>
        <CardHeader>
          <CardTitle>Scopes</CardTitle>
        </CardHeader>
        <CardContent>
          <ScopeSettings catalog={SPOTIFY_SCOPE_CATALOG} selected={configuredScopes} />
        </CardContent>
      </Card>
    </div>
  );
}
