export type MarketingEmailStatus = "DRAFT" | "SCHEDULED" | "SENT";
export type MarketingEmailAudienceType = "ALL" | "GROUP";

export type MarketingEmailCampaignDto = {
  id: string;
  title: string;
  status: MarketingEmailStatus;
  audienceType: MarketingEmailAudienceType | null;
  audienceBatchId: string | null;
  audienceLabel: string | null;
  subject: string | null;
  bodyHtml: string | null;
  templateKey: string | null;
  recipientCount: number;
  scheduledAt: string | null;
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MarketingEmailRecipient = {
  membershipId: string;
  displayName: string | null;
  email: string | null;
};

export type MarketingEmailTemplate = {
  key: string;
  name: string;
  description: string;
  subject: string;
  bodyHtml: string;
};

export type EmailAudienceEstimate = {
  audienceType: MarketingEmailAudienceType;
  audienceBatchId: string | null;
  totalCount: number;
};

export const EMAIL_LIST_HREF = "/admin/marketing/messenger/email";
export const EMAIL_CREATE_HREF = "/admin/marketing/messenger/email/create";
export const EMAIL_CHANNEL_SETTINGS_HREF = "/admin/channels/marketing-email";

export function marketingEmailHref(id: string) {
  return `/admin/marketing/messenger/email/${id}`;
}

export function formatEmailDateTime(value: string | null | undefined): string {
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

export function formatEmailDate(value: string | null | undefined): string {
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

export type MarketingEmailCampaignsSummary = {
  draftCount: number;
  scheduledCount: number;
  sentCount: number;
  totalReach: number;
  reach30d: number;
  reachTrendPercent: number | null;
  campaignCount: number;
};

export function emailRecipientInitials(
  displayName: string | null,
  email: string | null,
): string {
  const source = (displayName ?? email ?? "?").trim();
  if (!source) return "?";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]?.charAt(0) ?? ""}${parts[1]?.charAt(0) ?? ""}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

export type EmailWizardStep =
  | "title"
  | "audience"
  | "recipients"
  | "compose"
  | "delivery"
  | "settings";

export function resolveEmailWizardStep(
  campaign: MarketingEmailCampaignDto | null,
): EmailWizardStep {
  if (!campaign) return "title";
  if (campaign.status === "SENT") return "settings";
  if (!campaign.audienceType) return "audience";
  if (!campaign.subject || !campaign.bodyHtml) return "recipients";
  if (campaign.status === "SCHEDULED") return "delivery";
  return "compose";
}
