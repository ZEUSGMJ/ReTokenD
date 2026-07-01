import { NextRequest, NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import { REDIS_KEYS, NOTIFY_THRESHOLDS_DAYS, SIX_MONTHS_MS } from "@/lib/keys";
import { notify, buildStatusEmbed } from "@/lib/notify";
import { bearerMatches } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET ?? "";
  const authHeader = request.headers.get("authorization") ?? "";

  if (!bearerMatches(authHeader, cronSecret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const [issuedAt, reauthRequired] = await Promise.all([
    redis.get<string>(REDIS_KEYS.refreshTokenIssuedAt),
    redis.get<string>(REDIS_KEYS.reauthRequired),
  ]);

  const notifications: string[] = [];

  const expiresAtIso = issuedAt
    ? new Date(new Date(issuedAt).getTime() + SIX_MONTHS_MS).toISOString()
    : null;
  const daysLeft = issuedAt
    ? Math.floor(
        (new Date(issuedAt).getTime() + SIX_MONTHS_MS - Date.now()) / (1000 * 60 * 60 * 24)
      )
    : null;

  if (reauthRequired) {
    await notify(
      "ReTokenD: re-authorization is required. The refresh token was rejected by Spotify. Visit the dashboard and click Re-authorize.",
      [
        buildStatusEmbed({
          description:
            "Re-authorization required — Spotify rejected the refresh token. Re-authorize at the dashboard.",
          statusLabel: "Re-auth required",
          daysLeft,
          expiresAtIso,
        }),
      ]
    );
    notifications.push("reauth_required");
  }

  if (issuedAt && daysLeft !== null) {
    const displayDaysLeft = Math.max(daysLeft, 0);

    // Fire only the single most-urgent (smallest) not-yet-notified threshold
    // per run, then stop — avoids notifying every threshold at once.
    const sortedThresholds = [...NOTIFY_THRESHOLDS_DAYS].sort((a, b) => a - b);

    for (const threshold of sortedThresholds) {
      if (daysLeft <= threshold) {
        const notifiedKey = REDIS_KEYS.notified(threshold);
        const alreadyNotified = await redis.get<string>(notifiedKey);
        if (!alreadyNotified) {
          await notify(
            `ReTokenD: refresh token expires in ${displayDaysLeft} day(s) (threshold: ${threshold}). Re-authorize soon at the dashboard.`,
            [
              buildStatusEmbed({
                description: `Refresh token expires in ${displayDaysLeft} day(s) (threshold: ${threshold}). Re-authorize soon at the dashboard.`,
                statusLabel: "Expiring soon",
                daysLeft,
                expiresAtIso,
              }),
            ]
          );
          await redis.set(notifiedKey, "1");
          notifications.push(`threshold_${threshold}`);
          break;
        }
      }
    }
  }

  return NextResponse.json({ ok: true, notifications });
}
