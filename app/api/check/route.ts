import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/lib/storage";
import { NOTIFY_THRESHOLDS_DAYS, keysFor } from "@/lib/keys";
import { tokenLifecycle } from "@/lib/lifecycle";
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

  const { expiresAtIso, daysLeft } = tokenLifecycle(
    issuedAt,
    Date.now(),
    Boolean(reauthRequired)
  );

  if (reauthRequired) {
    // once per incident; cleared on re-auth
    const alreadyNotifiedReauth = await storage.get<string>(keys.notifiedReauth);
    if (!alreadyNotifiedReauth) {
      const delivered = await notify(
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
      // only mark delivered so a Discord outage retries next run
      if (delivered) {
        await storage.set(keys.notifiedReauth, "1");
        fired.push("reauth_required");
      }
    }
  }

  if (issuedAt && daysLeft !== null) {
    const displayDaysLeft = Math.max(daysLeft, 0);

    // NOTIFY_THRESHOLDS_DAYS is ascending: fire only the smallest not-yet-notified threshold
    for (const threshold of NOTIFY_THRESHOLDS_DAYS) {
      if (daysLeft <= threshold) {
        const notifiedKey = keys.notified(threshold);
        const alreadyNotified = await storage.get<string>(notifiedKey);
        if (!alreadyNotified) {
          const delivered = await notify(
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
          if (delivered) {
            // larger thresholds are implied by a smaller one firing — mark them all
            const implied = NOTIFY_THRESHOLDS_DAYS.filter((t) => t >= threshold);
            await Promise.all(implied.map((t) => storage.set(keys.notified(t), "1")));
            fired.push(`threshold_${threshold}`);
          }
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
