import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Countdown } from "@/components/dashboard/Countdown";
import { StatusBadge, type TokenStatus } from "@/components/dashboard/StatusBadge";
import { ScopeSettings } from "@/components/dashboard/ScopeSettings";
import { ProfileCredentialsForm } from "@/components/dashboard/ProfileCredentialsForm";
import { DeleteProfileButton } from "@/components/dashboard/DeleteProfileButton";
import { DEFAULT_PROFILE } from "@/lib/keys";
import { SPOTIFY_SCOPE_CATALOG } from "@/lib/spotify";
import { testNotification, toggleProfileEnabled } from "@/app/actions";

function formatDate(iso: string | null): string {
  if (!iso) return "Never";
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export interface ProfileCardData {
  profile: string;
  enabled: boolean;
  status: TokenStatus;
  issuedAt: string | null;
  expiresAtIso: string | null;
  lastRefresh: string | null;
  daysLeft: number | null;
  reauthRequired: boolean;
  displayName: string | null;
  accountId: string | null;
  configuredScopes: string[];
  hasCustomApp: boolean;
  clientId: string | null;
  showCredentials: boolean;
}

export function ProfileCard({ data }: { data: ProfileCardData }) {
  const {
    profile,
    enabled,
    status,
    issuedAt,
    expiresAtIso,
    lastRefresh,
    daysLeft,
    reauthRequired,
    displayName,
    accountId,
    configuredScopes,
    hasCustomApp,
    clientId,
    showCredentials,
  } = data;

  const showWarning = status !== "valid";
  const account = displayName ?? accountId;

  return (
    <Card data-profile={profile} className={enabled ? undefined : "opacity-60"}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-3">
          <span className="flex flex-col">
            <span className="font-mono text-base">{profile}</span>
            {account && (
              <span className="text-xs font-normal text-muted-foreground">{account}</span>
            )}
          </span>
          <span className="flex items-center gap-2">
            {!enabled && <span className="text-xs text-muted-foreground">Disabled</span>}
            <StatusBadge status={status} />
          </span>
        </CardTitle>
      </CardHeader>

      <CardContent className="flex flex-col gap-6">
        <div className="flex flex-col items-center gap-2 py-2">
          {issuedAt && expiresAtIso ? (
            <Countdown issuedAtIso={issuedAt} expiresAtIso={expiresAtIso} status={status} />
          ) : (
            <>
              <span className="font-mono text-3xl font-semibold">No token</span>
              <p className="text-sm text-muted-foreground">until refresh token expires</p>
            </>
          )}
          {showWarning && (
            <p className="mt-1 text-center text-sm font-medium text-destructive">
              {reauthRequired
                ? "Spotify rejected the refresh token. Re-authorization is required."
                : !issuedAt
                  ? "No refresh token on file. Re-authorize to get started."
                  : "The refresh token expires soon. Re-authorize before it does."}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-xs uppercase text-muted-foreground">Issued at</div>
            <div className="text-sm">{formatDate(issuedAt)}</div>
          </div>
          <div>
            <div className="text-xs uppercase text-muted-foreground">Expires at</div>
            <div className="text-sm">{formatDate(expiresAtIso)}</div>
          </div>
          <div>
            <div className="text-xs uppercase text-muted-foreground">Last refresh</div>
            <div className="text-sm">{formatDate(lastRefresh)}</div>
          </div>
          <div>
            <div className="text-xs uppercase text-muted-foreground">Days left</div>
            <div className="text-sm">{daysLeft !== null ? Math.max(daysLeft, 0) : "—"}</div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button render={<a href={`/api/login?profile=${profile}`} />} nativeButton={false} size="sm">
            Re-authorize
          </Button>
          <form action={testNotification}>
            <input type="hidden" name="profile" value={profile} />
            <Button type="submit" variant="outline" size="sm">
              Test notification
            </Button>
          </form>
          <form action={toggleProfileEnabled}>
            <input type="hidden" name="profile" value={profile} />
            <input type="hidden" name="enabled" value={enabled ? "0" : "1"} />
            <Button type="submit" variant="outline" size="sm">
              {enabled ? "Disable" : "Enable"}
            </Button>
          </form>
          {profile !== DEFAULT_PROFILE && <DeleteProfileButton profile={profile} />}
        </div>

        {showCredentials && (
          <details className="rounded-md border border-border">
            <summary className="cursor-pointer px-3 py-2 text-sm font-medium">
              Spotify app {hasCustomApp ? "(custom)" : "(shared)"}
            </summary>
            <div className="border-t border-border p-3">
              <ProfileCredentialsForm
                profile={profile}
                clientId={clientId}
                hasCustomApp={hasCustomApp}
              />
            </div>
          </details>
        )}

        <details className="rounded-md border border-border">
          <summary className="cursor-pointer px-3 py-2 text-sm font-medium">Scopes</summary>
          <div className="border-t border-border p-3">
            <ScopeSettings
              catalog={SPOTIFY_SCOPE_CATALOG}
              selected={configuredScopes}
              profile={profile}
            />
          </div>
        </details>
      </CardContent>
    </Card>
  );
}
