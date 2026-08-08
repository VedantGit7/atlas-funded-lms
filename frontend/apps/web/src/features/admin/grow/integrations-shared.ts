export type MarketingIntegrationEventKey =
  | "sign_up"
  | "purchase"
  | "lesson_completed"
  | "test_submit"
  | "trial_enrolment"
  | "initiate_transaction"
  | "profile_updated"
  | "custom_fields"
  | "mobile_otp_verification";

export type MarketingIntegrationSnippetsDto = {
  siteBodyHtml: string | null;
  orderTrackingHtml: string | null;
  signupTrackingHtml: string | null;
  updatedAt: string | null;
};

export type MarketingIntegrationWebhookDto = {
  id: string;
  eventKey: MarketingIntegrationEventKey;
  url: string;
  enabled: boolean;
  lastTestedAt: string | null;
  lastDeliveryAt: string | null;
  lastDeliveryStatus: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MarketingIntegrationEventGroup = {
  key: MarketingIntegrationEventKey;
  label: string;
  webhooks: MarketingIntegrationWebhookDto[];
};

export type MarketingIntegrationCredentialsDto = {
  schoolId: string;
  tenantSlug: string;
  apiKeyConfigured: boolean;
  apiKeyPrefix: string | null;
  apiKeyCreatedAt: string | null;
};

export type MarketingIntegrationOverviewDto = {
  webhookCount: number;
  webhookEnabledCount: number;
  webhooksWithDelivery: number;
  webhooksLastOkCount: number;
  webhooksLastErrorCount: number;
  snippetConfiguredCount: number;
  apiKeyConfigured: boolean;
  apiKeyCreatedAt: string | null;
  lastDeliveryAt: string | null;
  health: "healthy" | "attention" | "idle";
};

export type MarketingIntegrationDeliveryDto = {
  id: string;
  webhookId: string;
  eventKey: MarketingIntegrationEventKey;
  url: string;
  ok: boolean;
  statusCode: number | null;
  message: string;
  requestBody: string | null;
  source: "dispatch" | "test";
  createdAt: string;
};

/** Events that currently dispatch from the product (others are reserved). */
export const LIVE_INTEGRATION_EVENT_KEYS: ReadonlyArray<MarketingIntegrationEventKey> = [
  "sign_up",
  "purchase",
];

export const INTEGRATIONS_HREF = "/admin/marketing/integrations";
export const MARKETING_HREF = "/admin/marketing";

export const INTEGRATION_EVENT_HINTS: Record<MarketingIntegrationEventKey, string> = {
  sign_up: "Fires when a learner signs up or is created via the Sign Up action.",
  purchase: "Fires on paid enrollment / product purchase.",
  lesson_completed: "Reserved for lesson completion automations.",
  test_submit: "Reserved for test/quiz submission automations.",
  trial_enrolment: "Reserved for trial product enrolments.",
  initiate_transaction: "Reserved for checkout start events.",
  profile_updated: "Reserved for learner profile updates.",
  custom_fields: "Reserved for custom field form completions.",
  mobile_otp_verification: "Reserved for first-time mobile OTP verification.",
};

export function formatIntegrationRelativeTime(value: string | null | undefined): string {
  if (!value) return "-";
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
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatIntegrationDateTime(value: string | null | undefined): string {
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

export function deliveryStatusTone(
  status: string | null | undefined,
): "success" | "warning" | "danger" | "neutral" {
  if (!status) return "neutral";
  if (status.startsWith("ok:")) return "success";
  if (status.startsWith("error:")) return "danger";
  return "warning";
}

export function isLiveIntegrationEvent(key: MarketingIntegrationEventKey): boolean {
  return LIVE_INTEGRATION_EVENT_KEYS.includes(key);
}
