import type { MessengerInsightSnapshot } from "./insights.repository";
import type { InsightMessengerChannelsBoard } from "./insights.schemas";

export const MESSENGER_CHANNELS_CAVEAT =
  "Email, push, WhatsApp, and announcements are outbound and appear in every figure on this screen. Inbox messages are inbound and appear only where explicitly labelled.";

export const MESSENGER_CHANNELS_VOLUME_CAPTION =
  "Outbound reach counts recipients; inbox counts messages received. The two are plotted on separate axes and cannot be added.";

export const MESSENGER_CHANNELS_MANAGE_HREF = "/admin/marketing/messenger/email";

export const MESSENGER_CHANNELS_INBOX_HREF = "/admin/insights/messenger-insight/inbox";

const OUTBOUND_CHANNELS = [
  {
    id: "email" as const,
    label: "Email",
    href: "/admin/insights/messenger-insight/widgets/recent-email",
    sendsKey: "emailSentCount" as const,
    recipientsKey: "emailRecipients" as const,
    recentKey: "recentEmailCampaigns" as const,
  },
  {
    id: "push" as const,
    label: "Push",
    href: "/admin/insights/messenger-insight/widgets/recent-push",
    sendsKey: "pushSentCount" as const,
    recipientsKey: "pushRecipients" as const,
    recentKey: "recentPushMessages" as const,
  },
  {
    id: "whatsapp" as const,
    label: "WhatsApp",
    href: "/admin/insights/messenger-insight/whatsapp",
    sendsKey: "whatsappSentCount" as const,
    recipientsKey: "whatsappRecipients" as const,
    recentKey: "recentWhatsappCampaigns" as const,
  },
  {
    id: "announcements" as const,
    label: "Announcements",
    href: "/admin/insights/messenger-insight/widgets/recent-announcements",
    sendsKey: "announcementCount" as const,
    recipientsKey: "announcementRecipients" as const,
    recentKey: "recentAnnouncements" as const,
  },
];

function sharePct(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 1000) / 10;
}

function recipientsPerSend(sends: number, recipients: number): number | null {
  if (sends <= 0) return null;
  return Math.round((recipients / sends) * 10) / 10;
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

function formatUnusedCaption(names: string[]): string | null {
  if (names.length === 0) return null;
  const first = names[0];
  if (!first) return null;
  if (names.length === 1) return `${first} is currently unused.`;
  const second = names[1];
  if (names.length === 2) {
    if (!second) return null;
    return `${first} and ${second} are currently unused.`;
  }
  const head = names.slice(0, -1).join(", ");
  const last = names[names.length - 1];
  if (!last) return null;
  return `${head}, and ${last} are currently unused.`;
}

function ratioCaption(
  rows: Array<{ label: string; sends: number; recipientsPerSend: number | null }>,
): string | null {
  const ranked = rows
    .filter((row) => row.sends > 0 && row.recipientsPerSend != null)
    .map((row) => ({ label: row.label, ratio: row.recipientsPerSend as number }));
  if (ranked.length < 2) return null;
  const first = ranked[0];
  if (!first) return null;
  let highest = first;
  let lowest = first;
  for (const row of ranked.slice(1)) {
    if (row.ratio > highest.ratio) highest = row;
    if (row.ratio < lowest.ratio) lowest = row;
  }
  if (highest.label === lowest.label) return null;
  return `${highest.label} reaches the most people per send; ${lowest.label} reaches the fewest.`;
}

export function buildInsightMessengerChannels(
  snapshot: MessengerInsightSnapshot,
  generatedAt = new Date().toISOString(),
): InsightMessengerChannelsBoard {
  const outboundDefs = OUTBOUND_CHANNELS.map((channel) => {
    const sends = snapshot[channel.sendsKey];
    const recipients = snapshot[channel.recipientsKey];
    const active = sends > 0 || recipients > 0;
    return {
      id: channel.id,
      label: channel.label,
      href: channel.href,
      sends,
      recipients,
      recipientsPerSend: recipientsPerSend(sends, recipients),
      lastSentAt: latestSentAt(snapshot[channel.recentKey]),
      active,
    };
  });

  const active = outboundDefs.filter((row) => row.active);
  const unused = outboundDefs.filter((row) => !row.active);
  const unusedChannels = unused.map((row) => row.label);

  const totalSends = active.reduce((sum, row) => sum + row.sends, 0);
  const totalReach = active.reduce((sum, row) => sum + row.recipients, 0);
  const empty = snapshot.totalOutboundSends <= 0 && snapshot.totalOutboundReach <= 0;
  const channelsUsed = active.length;
  const singleChannel = channelsUsed === 1;

  const comparisonRows = active.map((row) => ({
    id: row.id,
    label: row.label,
    sends: row.sends,
    recipients: row.recipients,
    recipientsPerSend: row.recipientsPerSend,
    sendSharePct: sharePct(row.sends, totalSends),
    reachSharePct: sharePct(row.recipients, totalReach),
    href: row.href,
  }));

  const tableOutbound = active.map((row) => ({
    id: row.id,
    label: row.label,
    direction: "outbound" as const,
    sends: row.sends,
    recipients: row.recipients,
    recipientsPerSend: row.recipientsPerSend,
    sendSharePct: sharePct(row.sends, totalSends),
    reachSharePct: sharePct(row.recipients, totalReach),
    lastSentAt: row.lastSentAt,
    href: row.href,
  }));

  const volumePoints = snapshot.dailyVolume.map((row) => {
    const outboundTotal = row.emailRecipients + row.pushRecipients + row.whatsappRecipients;
    return {
      period: row.period,
      email: row.emailRecipients,
      push: row.pushRecipients,
      whatsapp: row.whatsappRecipients,
      inbox: row.inboxMessages,
      outboundTotal,
    };
  });

  const averageOutbound =
    volumePoints.length === 0
      ? null
      : Math.round(
          (volumePoints.reduce((sum, row) => sum + row.outboundTotal, 0) / volumePoints.length) *
            10,
        ) / 10;

  const campaignsSent = snapshot.totalOutboundSends;
  const outboundReach = snapshot.totalOutboundReach;
  const avgReachPerCampaign =
    campaignsSent > 0 ? Math.round((outboundReach / campaignsSent) * 10) / 10 : null;
  const scheduledTotal =
    snapshot.emailScheduledCount + snapshot.pushScheduledCount + snapshot.whatsappScheduledCount;

  const inbound =
    snapshot.inboxMessageCount > 0 || snapshot.openConversationCount > 0
      ? [
          {
            id: "inbox" as const,
            label: "Inbox messages" as const,
            direction: "inbound" as const,
            messageCount: snapshot.inboxMessageCount,
            openConversations: snapshot.openConversationCount,
            href: MESSENGER_CHANNELS_INBOX_HREF,
          },
        ]
      : [];

  return {
    slug: "messenger-insight",
    title: "Channels",
    subtitle: "What each channel sends, who it reaches, and how that has moved.",
    generatedAt,
    manageCampaignsHref: MESSENGER_CHANNELS_MANAGE_HREF,
    inboxHref: MESSENGER_CHANNELS_INBOX_HREF,
    caveat: MESSENGER_CHANNELS_CAVEAT,
    volumeCaption: MESSENGER_CHANNELS_VOLUME_CAPTION,
    empty,
    singleChannel,
    unusedChannels,
    unusedCaption:
      active.length > 0 && unusedChannels.length > 0 ? formatUnusedCaption(unusedChannels) : null,
    headline: {
      outboundReach,
      campaignsSent,
      avgReachPerCampaign,
      channelsUsed,
      scheduledTotal,
      scheduledCaption: "Email, push, and WhatsApp combined",
    },
    comparison: {
      caption: ratioCaption(comparisonRows),
      rows: comparisonRows,
    },
    volume: {
      averageOutbound,
      points: volumePoints,
    },
    table: {
      outbound: tableOutbound,
      inbound,
    },
  };
}
