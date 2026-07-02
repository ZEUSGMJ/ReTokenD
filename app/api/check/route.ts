import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/lib/storage";
import { NOTIFY_THRESHOLDS_DAYS, SIX_MONTHS_MS, keysFor } from "@/lib/keys";
import { notify, buildStatusEmbed } from "@/lib/notify";
import { bearerMatches } from "@/lib/auth";
import { listEnabledProfiles } from "@/lib/profiles";

export const runtime = "nodejs";

async function checkProfile(profile: string): Promise<string[]> {
  const keys = keysFor(profile);
  const fired: string[] = [];

  const [issuedAt, reauthRequired] = await Promise.all([
    storage.get<string>(keys.refreshTokenIssuedAt),
    storage.get<string>(keys.reauthRequired),
  ]);

  const expiresAtIso = issuedAt
    ? new Date(new Date(issuedAt).getTime() + SIX_MONTHS_MS).toISOString()
    : null;
  const daysLeft = issuedAt
    ? Math.floor(
        (new Date(issuedAt).getTime() + SIX_MONTHS_MS - Date.now()) / (1000 * 60 * 60 * 24)
      )
    : null;

  if (reauthRequired) {
    // once per incident; cleared on re-auth
    const alreadyNotifiedReauth = await storage.get<string>(keys.notifiedReauth);
    if (!alreadyNotifiedReauth) {
      await notify(
        `ReTokenD [${profile}]: re-authorization is required. The refresh token was rejected by Spotify. Visit the dashboard and click Re-authorize.`,
        [
          buildStatusEmbed({
            description:
              "Re-authorization required — Spotify rejected the refresh token. Re-authorize at the dashboard.",
            statusLabel: "Re-auth required",
            daysLeft,
            expiresAtIso,
            profile,
          }),
        ]
      );
      await storage.set(keys.notifiedReauth, "1");
      fired.push("reauth_required");
    }
  }

  if (issuedAt && daysLeft !== null) {
    const displayDaysLeft = Math.max(daysLeft, 0);

    // fire only the smallest not-yet-notified threshold per run
    const sortedThresholds = [...NOTIFY_THRESHOLDS_DAYS].sort((a, b) => a - b);

    for (const threshold of sortedThresholds) {
      if (daysLeft <= threshold) {
        const notifiedKey = keys.notified(threshold);
        const alreadyNotified = await storage.get<string>(notifiedKey);
        if (!alreadyNotified) {
          await notify(
            `ReTokenD [${profile}]: refresh token expires in ${displayDaysLeft} day(s) (threshold: ${threshold}). Re-authorize soon at the dashboard.`,
            [
              buildStatusEmbed({
                description: `Refresh token expires in ${displayDaysLeft} day(s) (threshold: ${threshold}). Re-authorize soon at the dashboard.`,
                statusLabel: "Expiring soon",
                daysLeft,
                expiresAtIso,
                profile,
              }),
            ]
          );
          await storage.set(notifiedKey, "1");
          fired.push(`threshold_${threshold}`);
          break;
        }
      }
    }
  }

  return fired;
}

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET ?? "";
  const authHeader = request.headers.get("authorization") ?? "";

  if (!bearerMatches(authHeader, cronSecret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const profiles = await listEnabledProfiles();
  const notifications: Record<string, string[]> = {};

  for (const profile of profiles) {
    const fired = await checkProfile(profile);
    if (fired.length > 0) notifications[profile] = fired;
  }

  return NextResponse.json({ ok: true, notifications });
}
