import { redirect } from "next/navigation";
import { storage } from "@/lib/storage";
import { keysFor } from "@/lib/keys";
import { tokenLifecycle } from "@/lib/lifecycle";
import { isSessionCurrent } from "@/lib/session-server";
import { getProfileMeta, isProfileEnabled, listProfiles } from "@/lib/profiles";
import { getConfiguredScopes } from "@/lib/spotify";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProfileCard, type ProfileCardData } from "@/app/components/ProfileCard";
import { AddProfileForm } from "@/app/components/AddProfileForm";
import { logout } from "@/app/actions";

export const dynamic = "force-dynamic";

async function loadProfile(profile: string, nowMs: number): Promise<ProfileCardData> {
  const keys = keysFor(profile);
  const [issuedAt, lastRefresh, reauthRequired, enabled, meta, configuredScopes, clientId] =
    await Promise.all([
      storage.get<string>(keys.refreshTokenIssuedAt),
      storage.get<string>(keys.lastRefresh),
      storage.get<string>(keys.reauthRequired),
      isProfileEnabled(profile),
      getProfileMeta(profile),
      getConfiguredScopes(profile),
      storage.get<string>(keys.clientId),
    ]);

  const { expiresAtIso, daysLeft, status } = tokenLifecycle(
    issuedAt,
    nowMs,
    Boolean(reauthRequired)
  );

  // saveProfileCredentials always writes client_id + secret as a pair (and
  // clearProfileCredentials deletes both), so client_id presence ⇒ custom app.
  const hasCustomApp = Boolean(clientId);

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
  // proxy checks signature + age; the generation check (server-side revocation) runs here
  if (!(await isSessionCurrent())) redirect("/login");

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
