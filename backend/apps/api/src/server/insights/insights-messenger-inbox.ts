import type { MessengerInboxInsightDetail, MessengerInsightSnapshot } from "./insights.repository";
import type { InsightMessengerInboxBoard } from "./insights.schemas";

export const INBOX_HREF = "/admin/messenger";

export const DIRECTION_NOTE =
  "Everything on this screen is inbound. It is never included in outbound reach or channel-mix figures.";

export const NO_ALERTING_CAPTION =
  "Messenger Insight has no alert rules for the inbox. Open conversations will not raise an alert however long they wait.";

export const ALERTS_HREF = "/admin/insights/messenger-insight/alerts";

function formatCount(value: number): string {
  return value.toLocaleString("en-US");
}

function formatPeriodShort(period: string): string {
  const date = new Date(`${period}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return period;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function isWeekendPeriod(period: string): boolean {
  const date = new Date(`${period}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return false;
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
}

function volumeCaption(
  points: Array<{ period: string; count: number; isWeekend: boolean }>,
  busiest: { period: string; count: number } | null,
  quietest: { period: string; count: number } | null,
): string | null {
  if (points.every((point) => point.count === 0)) return null;

  const parts: string[] = [];
  if (busiest) {
    parts.push(`Busiest ${formatPeriodShort(busiest.period)} (${formatCount(busiest.count)})`);
  }
  if (quietest && (!busiest || quietest.period !== busiest.period)) {
    parts.push(`quietest ${formatPeriodShort(quietest.period)} (${formatCount(quietest.count)})`);
  }

  const weekday: number[] = [];
  const weekend: number[] = [];
  for (const point of points) {
    if (point.isWeekend) weekend.push(point.count);
    else weekday.push(point.count);
  }

  const weekdayMean = mean(weekday);
  const weekendMean = mean(weekend);
  if (weekdayMean != null && weekendMean != null && weekday.length >= 3 && weekend.length >= 2) {
    parts.push(
      `weekday mean ${formatCount(weekdayMean)}, weekend mean ${formatCount(weekendMean)}`,
    );
  }

  if (parts.length === 0) return null;
  return `${parts.join("; ")}.`;
}

function responseCaption(detail: MessengerInboxInsightDetail): string | null {
  const { samples, longestWaitingSeconds } = detail.responseTimes;
  if (samples <= 0 && longestWaitingSeconds == null) return null;
  if (samples > 0) {
    return `Based on ${formatCount(samples)} first-reply sample${samples === 1 ? "" : "s"}.`;
  }
  return "First-reply samples are not available yet; open waits still appear above when learners are waiting on us.";
}

export function buildInsightMessengerInbox(
  snapshot: MessengerInsightSnapshot,
  detail: MessengerInboxInsightDetail,
  generatedAt = new Date().toISOString(),
): InsightMessengerInboxBoard {
  const inboxMessages = snapshot.inboxMessageCount;
  const inboxMessages30d = snapshot.inboxMessages30d;
  const openConversations = snapshot.openConversationCount;
  const empty = inboxMessages === 0 && openConversations === 0;
  const allClear = !empty && openConversations === 0;

  const volumePoints = snapshot.dailyVolume.map((row) => ({
    period: row.period,
    count: row.inboxMessages,
    isWeekend: isWeekendPeriod(row.period),
  }));

  const activeDays = volumePoints.filter((point) => point.count > 0);
  let busiest: { period: string; count: number } | null = null;
  let quietest: { period: string; count: number } | null = null;
  for (const point of activeDays) {
    if (!busiest || point.count > busiest.count) {
      busiest = { period: point.period, count: point.count };
    }
    if (!quietest || point.count < quietest.count) {
      quietest = { period: point.period, count: point.count };
    }
  }

  const volumeMean = mean(volumePoints.map((point) => point.count));
  const averagePerDay = inboxMessages30d > 0 ? Math.round((inboxMessages30d / 30) * 10) / 10 : null;

  const nowMs = Date.now();
  const conversationRows = detail.openConversations.map((row) => {
    const ageSeconds = Math.max(0, Math.floor((nowMs - Date.parse(row.lastMessageAt)) / 1000));
    const waitingPast48h =
      row.waitingOn === "us" && Number.isFinite(ageSeconds) && ageSeconds > 48 * 3600;
    return {
      id: row.id,
      learnerName: row.learnerName,
      lastMessagePreview: row.lastMessagePreview,
      messageCount: row.messageCount,
      lastMessageAt: row.lastMessageAt,
      waitingOn: row.waitingOn,
      waitingPast48h,
      href: INBOX_HREF,
    };
  });

  return {
    slug: "messenger-insight",
    title: "Inbox",
    subtitle: "What learners are sending in, and what is still waiting.",
    generatedAt,
    inboxHref: INBOX_HREF,
    alertsHref: ALERTS_HREF,
    directionNote: DIRECTION_NOTE,
    empty,
    allClear,
    headline: {
      inboxMessages,
      inboxMessages30d,
      inboxMessagesCaption: `${formatCount(inboxMessages30d)} in the last 30 days`,
      openConversations,
      messages30d: inboxMessages30d,
      averagePerDay,
      busiestDay: busiest,
      quietestDay: quietest,
    },
    volume: {
      mean: volumeMean,
      caption: volumeCaption(volumePoints, busiest, quietest),
      points: volumePoints,
    },
    conversations: {
      totalOpen: openConversations,
      rows: conversationRows,
    },
    responseTime: {
      available: detail.responseTimes.samples > 0,
      medianFirstReplySeconds: detail.responseTimes.medianFirstReplySeconds,
      longestFirstReplySeconds: detail.responseTimes.longestFirstReplySeconds,
      longestWaitingSeconds: detail.responseTimes.longestWaitingSeconds,
      caption: responseCaption(detail),
      buckets: detail.responseTimes.buckets,
    },
    noAlerting: {
      caption: NO_ALERTING_CAPTION,
      href: ALERTS_HREF,
    },
  };
}
