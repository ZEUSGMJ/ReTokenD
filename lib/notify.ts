// Notification channel: Discord webhook (POST {content} + optional embeds).
// Kept behind this single notify() function so the channel can be swapped
// later (bot/email/ntfy/etc.) without touching callers. Fails soft: logs but
// never throws, so a notification failure can't crash the cron route.

export const BROKER_EMBED_TITLE = "ReTokenD – Spotify Token Broker";
export const SPOTIFY_GREEN = 0x1db954;

export interface DiscordEmbed {
  title?: string;
  description?: string;
  color?: number;
  fields?: { name: string; value: string; inline?: boolean }[];
  footer?: { text: string };
  timestamp?: string;
}

/**
 * Build the standard broker status embed shared by the dashboard "Test
 * Notification" action and the cron expiry alerts. Takes primitives only so
 * lib/ stays independent of app-layer types.
 */
export function buildStatusEmbed({
  description,
  statusLabel,
  daysLeft,
  expiresAtIso,
  footer,
}: {
  description: string;
  statusLabel: string;
  daysLeft: number | null;
  expiresAtIso: string | null;
  footer?: string;
}): DiscordEmbed {
  const expiresAtEpoch = expiresAtIso
    ? Math.floor(new Date(expiresAtIso).getTime() / 1000)
    : null;

  return {
    title: BROKER_EMBED_TITLE,
    description,
    color: SPOTIFY_GREEN,
    fields: [
      { name: "Status", value: statusLabel, inline: true },
      {
        name: "Days Remaining",
        value: daysLeft !== null ? String(Math.max(daysLeft, 0)) : "—",
        inline: true,
      },
      ...(expiresAtEpoch
        ? [{ name: "Expires At", value: `<t:${expiresAtEpoch}:F>`, inline: false }]
        : []),
    ],
    ...(footer ? { footer: { text: footer } } : {}),
    timestamp: new Date().toISOString(),
  };
}

export async function notify(message: string, embeds?: DiscordEmbed[]): Promise<void> {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) {
    console.error("notify(): DISCORD_WEBHOOK_URL is not set; skipping notification");
    return;
  }

  try {
    const payload: Record<string, unknown> = { content: message };
    if (embeds && embeds.length > 0) {
      payload.embeds = embeds;
    }

    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.error(`notify(): Discord webhook responded ${res.status}`);
    }
  } catch (err) {
    console.error("notify(): failed to send Discord webhook", err);
  }
}
