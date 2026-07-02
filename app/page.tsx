import { storage } from "@/lib/storage";
import { SIX_MONTHS_MS, keysFor } from "@/lib/keys";
import { getProfileMeta, isProfileEnabled, listProfiles } from "@/lib/profiles";
import { getConfiguredScopes, hasStoredCredentials } from "@/lib/spotify";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProfileCard, type ProfileCardData } from "@/app/components/ProfileCard";
import { AddProfileForm } from "@/app/components/AddProfileForm";
import type { TokenStatus } from "@/app/components/StatusBadge";
import { logout } from "@/app/actions";

export const dynamic = "force-dynamic";

async function loadProfile(profile: string, nowMs: number): Promise<ProfileCardData> {
  const keys = keysFor(profile);
  const [issuedAt, lastRefresh, reauthRequired, enabled, meta, configuredScopes, clientId, hasCustomApp] =
    await Promise.all([
      storage.get<string>(keys.refreshTokenIssuedAt),
      storage.get<string>(keys.lastRefresh),
      storage.get<string>(keys.reauthRequired),
      isProfileEnabled(profile),
      getProfileMeta(profile),
      getConfiguredScopes(profile),
      storage.get<string>(keys.clientId),
      hasStoredCredentials(profile),
    ]);

  const expiresAtIso = issuedAt
    ? new Date(new Date(issuedAt).getTime() + SIX_MONTHS_MS).toISOString()
    : null;
  const daysLeft = expiresAtIso
    ? Math.floor((new Date(expiresAtIso).getTime() - nowMs) / (1000 * 60 * 60 * 24))
    : null;

  let status: TokenStatus = "expired-or-reauth-required";
  if (!reauthRequired && issuedAt && daysLeft !== null) {
    if (daysLeft <= 0) status = "expired-or-reauth-required";
    else if (daysLeft <= 14) status = "expiring-soon";
    else status = "valid";
  }

  return {
    profile,
    enabled,
    status,
    issuedAt,
    expiresAtIso,
    lastRefresh,
    daysLeft,
    reauthRequired: Boolean(reauthRequired),
    displayName: meta.displayName,
    accountId: meta.accountId,
    configuredScopes,
    hasCustomApp,
    clientId,
  };
}

export default async function Dashboard() {
  const profiles = await listProfiles();

  // force-dynamic: renders once per request
  // eslint-disable-next-line react-hooks/purity
  const nowMs = Date.now();
  const cards = await Promise.all(profiles.map((p) => loadProfile(p, nowMs)));

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-6">
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

      {cards.map((data) => (
        <ProfileCard key={data.profile} data={data} />
      ))}

      <Card>
        <CardHeader>
          <CardTitle>Add profile</CardTitle>
        </CardHeader>
        <CardContent>
          <AddProfileForm />
        </CardContent>
      </Card>
    </div>
  );
}
