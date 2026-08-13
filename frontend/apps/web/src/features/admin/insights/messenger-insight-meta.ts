export const MESSENGER_INSIGHT_OUTBOUND_KPI_IDS = [
  "outbound-sends",
  "outbound-reach",
  "email-sent",
  "email-reach",
] as const;

export const MESSENGER_INSIGHT_EMAIL_PUSH_KPI_IDS = [
  "email-reach-30d",
  "push-sent",
  "push-reach",
  "whatsapp-sent",
] as const;

export const MESSENGER_INSIGHT_WHATSAPP_KPI_IDS = [
  "whatsapp-delivered",
  "whatsapp-failed",
  "whatsapp-delivery-rate",
  "announcements",
] as const;

export const MESSENGER_INSIGHT_INBOUND_KPI_IDS = [
  "inbox-messages",
  "inbox-30d",
  "open-conversations",
  "scheduled-total",
] as const;

export const MESSENGER_INSIGHT_PERCENT_KPI_IDS = new Set(["whatsapp-delivery-rate"]);

export const MESSENGER_INSIGHT_INVERTED_KPI_IDS = new Set(["whatsapp-failed"]);

export const MESSENGER_INSIGHT_NON_LINKABLE_KPI_IDS = new Set(["scheduled-total"]);

export const MESSENGER_WA_EMPTY_CAPTION = "No WhatsApp sends recorded";

export const MESSENGER_SCHEDULED_CAPTION = "Email, push, and WhatsApp combined";

export const MESSENGER_FAILED_CAPTION = "Higher is worse";

export const MESSENGER_FIXED_WINDOW_CAPTION =
  "Messenger Insight uses fixed windows shown in each widget title.";

export const MESSENGER_DIRECTION_CAPTION =
  "Email, push, WhatsApp, and announcements are outbound. Inbox messages are inbound.";

export const MESSENGER_DAILY_VOLUME_CAPTION =
  "Outbound reach counts recipients; inbox counts messages received. The two are plotted on separate axes and cannot be added.";

export const MESSENGER_DUAL_SERIES_IDS = new Set(["daily-volume"]);

export const MESSENGER_CHANNEL_PAIR_CAPTION =
  "Sends and recipients are different units and are plotted on separate scales.";

export const MESSENGER_ALERT_COVERAGE_CAPTION =
  "Only WhatsApp has alert rules here. Silence on email, push, announcements, and inbox does not mean those channels are healthy.";

export const MESSENGER_RANGE_SHORT_LABELS: Record<"12m" | "30d" | "ytd", string> = {
  "12m": "12m",
  "30d": "30d",
  ytd: "YTD",
};

export const MESSENGER_INSIGHT_CHART_WIDGET_IDS = [
  "channel-mix-sends",
  "channel-mix-reach",
  "daily-volume",
  "recent-email",
  "recent-push",
  "recent-whatsapp",
  "recent-announcements",
] as const;

export const MESSENGER_BAR_WIDGET_IDS = new Set(["channel-mix-sends", "channel-mix-reach"]);

export const MESSENGER_TABLE_WIDGET_IDS = new Set([
  "recent-email",
  "recent-push",
  "recent-whatsapp",
  "recent-announcements",
]);

export const MESSENGER_WHATSAPP_KPI_MUTE_IDS = new Set([
  "whatsapp-sent",
  "whatsapp-delivered",
  "whatsapp-failed",
  "whatsapp-delivery-rate",
]);

export type MessengerStatusTone = "success" | "danger" | "warning" | "neutral";

export function messengerStatusTone(raw: string): MessengerStatusTone {
  const value = raw.toLowerCase();
  if (
    value.includes("sent") ||
    value.includes("deliver") ||
    value.includes("complet") ||
    value.includes("success") ||
    value.includes("published")
  ) {
    return "success";
  }
  if (value.includes("fail") || value.includes("error") || value.includes("bounce")) {
    return "danger";
  }
  if (
    value.includes("schedul") ||
    value.includes("draft") ||
    value.includes("pending") ||
    value.includes("queue") ||
    value.includes("sending")
  ) {
    return "warning";
  }
  return "neutral";
}

export function messengerChannelBarTone(index: number): string {
  const tones = [
    "bg-[var(--admin-primary)]",
    "bg-[color-mix(in_srgb,var(--admin-primary)_72%,var(--admin-surface))]",
    "bg-[color-mix(in_srgb,var(--admin-primary)_48%,var(--admin-outline))]",
    "bg-[var(--admin-success)]",
    "bg-[var(--admin-outline)]",
  ];
  return tones[index % tones.length] ?? "bg-[var(--admin-primary)]";
}

export function messengerChannelMixCaption(
  sends: Array<{ label: string; value: number }>,
  reach: Array<{ label: string; value: number }>,
): string | null {
  const totalSends = sends.reduce((sum, row) => sum + row.value, 0);
  const totalReach = reach.reduce((sum, row) => sum + row.value, 0);
  if (totalSends <= 0 || totalReach <= 0) return null;

  let best: { label: string; sendShare: number; reachShare: number; gap: number } | null = null;
  for (const sendRow of sends) {
    const reachRow = reach.find((row) => row.label.toLowerCase() === sendRow.label.toLowerCase());
    if (!reachRow) continue;
    const sendShare = Math.round((sendRow.value / totalSends) * 100);
    const reachShare = Math.round((reachRow.value / totalReach) * 100);
    const gap = Math.abs(reachShare - sendShare);
    if (!best || gap > best.gap) {
      best = { label: sendRow.label, sendShare, reachShare, gap };
    }
  }
  if (!best || best.gap < 8) return null;
  return `${best.label} is ${best.sendShare}% of sends but ${best.reachShare}% of reach.`;
}

export function messengerWidgetEmptyCopy(widgetId: string): { title: string; body: string } {
  switch (widgetId) {
    case "channel-mix-sends":
    case "channel-mix-reach":
      return {
        title: "No channel activity yet",
        body: "Email, push, WhatsApp, and announcement sends will appear here once campaigns go out.",
      };
    case "daily-volume":
      return {
        title: "Awaiting messaging activity",
        body: "Outbound reach and inbound replies will plot here as campaigns and inbox traffic start.",
      };
    case "recent-email":
      return {
        title: "No marketing emails sent yet",
        body: "Recent email campaigns will list here after the first send.",
      };
    case "recent-push":
      return {
        title: "No push messages sent yet",
        body: "Push notifications will appear here once they are delivered to learners.",
      };
    case "recent-whatsapp":
      return {
        title: "No WhatsApp campaigns sent yet",
        body: "Template campaigns and delivery outcomes will list here after WhatsApp sends.",
      };
    case "recent-announcements":
      return {
        title: "No announcements sent yet",
        body: "In-app announcements will appear here after they are published.",
      };
    default:
      return {
        title: "Nothing to show yet",
        body: "This widget fills in as messaging activity lands.",
      };
  }
}
