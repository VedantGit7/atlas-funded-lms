export type PushMessageStatus = "DRAFT" | "SCHEDULED" | "SENT";
export type PushAudienceType = "ALL" | "GROUP";

export type PushMessageDto = {
  id: string;
  title: string;
  status: PushMessageStatus;
  audienceType: PushAudienceType | null;
  audienceBatchId: string | null;
  audienceLabel: string | null;
  subject: string | null;
  body: string | null;
  deepLink: string | null;
  imageUrl: string | null;
  channels: {
    android: boolean;
    ios: boolean;
    web: boolean;
  };
  recipientCount: number;
  scheduledAt: string | null;
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PushRecipient = {
  membershipId: string;
  displayName: string | null;
  email: string | null;
};

export const PUSH_LIST_HREF = "/admin/marketing/messenger/push";
export const PUSH_CREATE_HREF = "/admin/marketing/messenger/push/create";

export function pushMessageHref(id: string) {
  return `/admin/marketing/messenger/push/${id}`;
}

export function formatPushDateTime(value: string | null | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatPushDate(value: string | null | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatCompactCount(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  }
  return String(value);
}

export type PushMessagesSummary = {
  draftCount: number;
  scheduledCount: number;
  sentCount: number;
  totalReach: number;
  reach30d: number;
  reachTrendPercent: number | null;
  channelCoverage: {
    androidPercent: number;
    iosPercent: number;
    webPercent: number;
  };
  messageCount: number;
};

export function resolveWizardStep(message: PushMessageDto | null): WizardStep {
  if (!message) return "title";
  if (message.status === "SENT") return "settings";
  if (!message.audienceType) return "audience";
  if (!message.subject || !message.body) return "recipients";
  if (message.status === "SCHEDULED") return "delivery";
  return "compose";
}

export type WizardStep =
  | "title"
  | "audience"
  | "recipients"
  | "compose"
  | "delivery"
  | "settings";

export type PushAudienceEstimate = {
  audienceType: PushAudienceType;
  audienceBatchId: string | null;
  totalCount: number;
};

export function recipientInitials(displayName: string | null, email: string | null): string {
  const source = (displayName ?? email ?? "?").trim();
  if (!source) return "?";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}
