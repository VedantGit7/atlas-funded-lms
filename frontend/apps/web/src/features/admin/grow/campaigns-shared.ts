export type CampaignGoal = "REACTIVATION" | "CONVERSION" | "ONBOARDING" | "RETENTION";

export type CampaignStatus = "DRAFT" | "SCHEDULED" | "SENT";
export type CampaignAudienceType = "ALL" | "GROUP";
export type CampaignChannel = "email" | "push" | "announcement" | "whatsapp";

export type CampaignChannels = {
  email: boolean;
  push: boolean;
  announcement: boolean;
  whatsapp: boolean;
};

export type CampaignTouchpoint = {
  id: string;
  channel: CampaignChannel;
  title: string;
  subject?: string | null;
  body?: string | null;
  delayDays: number;
  linkedCampaignId?: string | null;
  linkedStatus?: CampaignStatus | null;
};

export type MarketingCampaignDto = {
  id: string;
  title: string;
  goal: CampaignGoal | null;
  status: CampaignStatus;
  audienceType: CampaignAudienceType | null;
  audienceBatchId: string | null;
  audienceLabel: string | null;
  recipientCount: number;
  channels: CampaignChannels;
  touchpoints: CampaignTouchpoint[];
  launchedAt: string | null;
  scheduledAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CampaignListSummary = {
  draftCount: number;
  scheduledCount: number;
  sentCount: number;
  totalCount: number;
  totalReach: number;
};

export type CampaignAnalyticsDto = {
  campaignId: string;
  title: string;
  status: CampaignStatus;
  goal: CampaignGoal | null;
  launchedAt: string | null;
  audienceLabel: string | null;
  totalReach: number;
  touchpointCount: number;
  channels: Array<{
    channel: CampaignChannel;
    linkedCampaignId: string | null;
    title: string;
    status: CampaignStatus | null;
    recipientCount: number;
    deliveredCount: number | null;
    failedCount: number | null;
    scheduledAt: string | null;
    sentAt: string | null;
    href: string;
  }>;
  note: string;
};

export type BuilderStep = "goal" | "audience" | "touchpoints" | "review";

export const CAMPAIGNS_HREF = "/admin/marketing/campaign";
export const CAMPAIGN_CREATE_HREF = "/admin/marketing/campaign/create";
export const MARKETING_HREF = "/admin/marketing";
export const MESSENGER_HREF = "/admin/marketing/messenger";

export function campaignHref(id: string) {
  return `/admin/marketing/campaign/${id}`;
}

export function campaignAnalyticsHref(id: string) {
  return `/admin/marketing/campaign/${id}/analytics`;
}

export const BUILDER_STEPS: ReadonlyArray<{
  id: BuilderStep;
  label: string;
  index: number;
}> = [
  { id: "goal", label: "Goal & Title", index: 1 },
  { id: "audience", label: "Audience", index: 2 },
  { id: "touchpoints", label: "Touchpoints", index: 3 },
  { id: "review", label: "Review", index: 4 },
];

export const GOAL_OPTIONS: ReadonlyArray<{
  id: CampaignGoal;
  label: string;
  description: string;
}> = [
  {
    id: "REACTIVATION",
    label: "Re-activation",
    description: "Re-engage dormant learners who have not logged in recently.",
  },
  {
    id: "CONVERSION",
    label: "Conversion",
    description: "Drive first enrollments and purchases for interested leads.",
  },
  {
    id: "ONBOARDING",
    label: "Onboarding",
    description: "Guide new sign-ups through their first week on the platform.",
  },
  {
    id: "RETENTION",
    label: "Retention",
    description: "Reward active learners and reinforce ongoing progress.",
  },
];

export function campaignGoalLabel(goal: CampaignGoal | null): string {
  if (!goal) return "Not set";
  return GOAL_OPTIONS.find((option) => option.id === goal)?.label ?? goal;
}

export function campaignStatusLabel(status: CampaignStatus): string {
  if (status === "SENT") return "Completed";
  if (status === "SCHEDULED") return "Scheduled";
  return "Draft";
}

export function campaignChannelLabel(channel: CampaignChannel): string {
  if (channel === "email") return "Email";
  if (channel === "push") return "Push";
  if (channel === "announcement") return "Announcement";
  return "WhatsApp";
}

export function formatCampaignCount(value: number): string {
  return new Intl.NumberFormat(undefined).format(value);
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

export function formatCampaignDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatCampaignRelativeTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const deltaMs = Date.now() - date.getTime();
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (deltaMs < minute) return "Just now";
  if (deltaMs < hour) {
    const mins = Math.max(1, Math.floor(deltaMs / minute));
    return mins === 1 ? "1 min ago" : `${String(mins)} mins ago`;
  }
  if (deltaMs < day) {
    const hours = Math.max(1, Math.floor(deltaMs / hour));
    return hours === 1 ? "1 hour ago" : `${String(hours)} hours ago`;
  }
  if (deltaMs < 2 * day) return "Yesterday";
  return formatCampaignDate(value);
}

export function resolveBuilderStep(campaign: MarketingCampaignDto | null): BuilderStep {
  if (!campaign) return "goal";
  if (campaign.status !== "DRAFT") return "review";
  if (!campaign.goal || !campaign.title.trim()) return "goal";
  if (!campaign.audienceType) return "audience";
  if (campaign.touchpoints.length === 0) return "touchpoints";
  return "review";
}

export function emptyChannels(): CampaignChannels {
  return { email: true, push: false, announcement: false, whatsapp: false };
}

export function createLocalTouchpointId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `tp-${String(Date.now())}`;
}
