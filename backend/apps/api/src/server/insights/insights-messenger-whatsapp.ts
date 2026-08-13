import type { MessengerInsightSnapshot } from "./insights.repository";
import type { InsightMessengerWhatsappBoard } from "./insights.schemas";

export const MESSENGER_WHATSAPP_SETTINGS_HREF = "/admin/marketing/messenger/whatsapp";

export const MESSENGER_WHATSAPP_TEMPLATES_HREF = "/admin/marketing/messenger/whatsapp/templates";

export const MESSENGER_WHATSAPP_GUIDANCE_CAPTION =
  "The platform records the failure count but not always the reason, so this list is guidance rather than a diagnosis.";

export const MESSENGER_WHATSAPP_FIXED_WINDOW_CAPTION =
  "WhatsApp figures use fixed windows from campaign history.";

export const MESSENGER_WHATSAPP_GUIDANCE_ITEMS = [
  {
    id: "opt-in",
    title: "Recipient has not opted in",
    description: "WhatsApp requires an explicit opt-in before marketing sends.",
    href: MESSENGER_WHATSAPP_SETTINGS_HREF,
  },
  {
    id: "unregistered",
    title: "Number not registered on WhatsApp",
    description: "The destination number may not be active on WhatsApp.",
    href: MESSENGER_WHATSAPP_SETTINGS_HREF,
  },
  {
    id: "template",
    title: "Template not approved",
    description: "Outbound templates must be approved before they can deliver.",
    href: MESSENGER_WHATSAPP_TEMPLATES_HREF,
  },
  {
    id: "rate-limit",
    title: "Rate limit reached",
    description: "Provider throughput limits can reject bursts of sends.",
    href: MESSENGER_WHATSAPP_SETTINGS_HREF,
  },
  {
    id: "token",
    title: "Integration token expired",
    description: "Reconnect WhatsApp if the Business API token has expired.",
    href: MESSENGER_WHATSAPP_SETTINGS_HREF,
  },
] as const;

function sharePct(part: number, total: number): number | null {
  if (total <= 0) return null;
  return Math.round((part / total) * 1000) / 10;
}

function deliveryRatePct(delivered: number, recipients: number): number | null {
  if (recipients <= 0) return null;
  return Math.round((delivered / recipients) * 1000) / 10;
}

function latestSentAt(rows: Array<{ sentAt: string | null }>): string | null {
  let latest: string | null = null;
  let latestMs = -Infinity;
  for (const row of rows) {
    if (!row.sentAt) continue;
    const ms = Date.parse(row.sentAt);
    if (Number.isNaN(ms)) continue;
    if (ms > latestMs) {
      latestMs = ms;
      latest = row.sentAt;
    }
  }
  return latest;
}

function formatPeriodShort(period: string): string {
  const date = new Date(`${period}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return period;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

function formatCount(value: number): string {
  return value.toLocaleString("en-US");
}

function unusualFailureCaption(
  points: Array<{ period: string; delivered: number; failed: number }>,
): string | null {
  const active = points.filter((point) => point.delivered + point.failed > 0);
  if (active.length < 2) return null;

  const shares = active.map((point) => {
    const total = point.delivered + point.failed;
    return {
      period: point.period,
      failed: point.failed,
      share: point.failed / total,
    };
  });

  const avgShare = shares.reduce((sum, row) => sum + row.share, 0) / shares.length;

  const firstShare = shares[0];
  if (!firstShare) return null;
  let worst = firstShare;
  for (const row of shares.slice(1)) {
    if (row.share > worst.share || (row.share === worst.share && row.failed > worst.failed)) {
      worst = row;
    }
  }

  if (worst.failed <= 0) return null;
  if (worst.share < 0.1 && worst.failed < 5) return null;
  if (avgShare > 0 && worst.share < avgShare * 2) return null;
  if (avgShare === 0 && worst.share < 0.25) return null;

  const pct = Math.round(worst.share * 1000) / 10;
  return `${formatPeriodShort(worst.period)} recorded an unusual failure share (${String(pct)}%).`;
}

function compositionCaption(
  delivered: number,
  failed: number,
  pending: number,
  recipients: number,
): string {
  if (pending > 0) {
    return `${formatCount(delivered)} delivered + ${formatCount(failed)} failed + ${formatCount(pending)} pending = ${formatCount(recipients)} recipients.`;
  }
  return `${formatCount(delivered)} delivered + ${formatCount(failed)} failed = ${formatCount(recipients)} recipients.`;
}

function isFullyFailed(input: {
  status: string;
  recipients: number;
  delivered: number;
  failed: number;
}): boolean {
  if (input.status.toLowerCase().includes("fail")) return true;
  return input.recipients > 0 && input.delivered === 0 && input.failed >= input.recipients;
}

export function buildInsightMessengerWhatsapp(
  snapshot: MessengerInsightSnapshot,
  generatedAt = new Date().toISOString(),
): InsightMessengerWhatsappBoard {
  const recipients = snapshot.whatsappRecipients;
  const delivered = snapshot.whatsappDelivered;
  const failed = snapshot.whatsappFailed;
  const campaignsSent = snapshot.whatsappSentCount;
  const scheduled = snapshot.whatsappScheduledCount;
  const empty = campaignsSent === 0 && recipients === 0;
  const perfectDelivery = recipients > 0 && failed === 0;
  const connected = snapshot.whatsappConnected;
  const historical = !connected && !empty;
  const pending = Math.max(0, recipients - delivered - failed);
  const deliveryRate = deliveryRatePct(delivered, recipients);
  const failedShare = sharePct(failed, recipients);

  const failurePoints = snapshot.dailyVolume.map((row) => ({
    period: row.period,
    delivered: row.whatsappDelivered,
    failed: row.whatsappFailed,
  }));

  const campaignRows = [...snapshot.recentWhatsappCampaigns]
    .map((row) => {
      const rate = deliveryRatePct(row.deliveredCount, row.recipientCount);
      return {
        id: row.id,
        title: row.title,
        status: row.status,
        recipients: row.recipientCount,
        delivered: row.deliveredCount,
        failed: row.failedCount,
        deliveryRatePct: rate,
        belowAverage: false,
        fullyFailed: isFullyFailed({
          status: row.status,
          recipients: row.recipientCount,
          delivered: row.deliveredCount,
          failed: row.failedCount,
        }),
        sentAt: row.sentAt,
        href: `${MESSENGER_WHATSAPP_SETTINGS_HREF}/${row.id}`,
      };
    })
    .sort((a, b) => {
      const aMs = a.sentAt ? Date.parse(a.sentAt) : Number.NEGATIVE_INFINITY;
      const bMs = b.sentAt ? Date.parse(b.sentAt) : Number.NEGATIVE_INFINITY;
      return bMs - aMs;
    });

  const rated = campaignRows.filter((row) => row.deliveryRatePct != null);
  const averageDeliveryRatePct =
    rated.length === 0
      ? null
      : Math.round(
          (rated.reduce((sum, row) => sum + (row.deliveryRatePct as number), 0) / rated.length) *
            10,
        ) / 10;

  const rows = campaignRows.map((row) => ({
    ...row,
    belowAverage:
      averageDeliveryRatePct != null &&
      row.deliveryRatePct != null &&
      row.deliveryRatePct < averageDeliveryRatePct,
  }));

  return {
    slug: "messenger-insight",
    title: "WhatsApp",
    subtitle: "The only channel that reports per-send delivery outcomes.",
    generatedAt,
    settingsHref: MESSENGER_WHATSAPP_SETTINGS_HREF,
    connected,
    lastSentAt: latestSentAt(snapshot.recentWhatsappCampaigns),
    empty,
    perfectDelivery,
    historical,
    headline: {
      deliveryRatePct: deliveryRate,
      deliveryRateCaption:
        recipients > 0
          ? `${formatCount(delivered)} delivered of ${formatCount(recipients)} recipients`
          : null,
      campaignsSent,
      delivered,
      failed,
      failedSharePct: failedShare,
      scheduled,
    },
    composition: {
      delivered,
      failed,
      pending,
      recipients,
      caption: compositionCaption(delivered, failed, pending, recipients),
    },
    failures: {
      caption: unusualFailureCaption(failurePoints),
      points: failurePoints,
    },
    guidance: {
      caption: MESSENGER_WHATSAPP_GUIDANCE_CAPTION,
      items: MESSENGER_WHATSAPP_GUIDANCE_ITEMS.map((item) => ({ ...item })),
    },
    campaigns: {
      averageDeliveryRatePct,
      rows,
    },
  };
}
