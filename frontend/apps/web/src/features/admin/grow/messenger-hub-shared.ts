export type MessengerHubSummary = {
  email: {
    activeCount: number;
    scheduledCount: number;
    draftCount: number;
    sentCount: number;
    totalReach: number;
    weeklySent: number[];
    latestTitle: string | null;
  };
  push: {
    activeCount: number;
    sentCount: number;
    totalReach: number;
  };
  systemEmail: {
    enabledCount: number;
    totalCount: number;
  };
  announcements: {
    sentCount: number;
    totalReach: number;
  };
  whatsapp: {
    connectionStatus: "CONNECTED" | "DISCONNECTED";
    activeCount: number;
    sentCount: number;
  };
  integrations: {
    webhookCount: number;
    webhookEnabledCount: number;
    lastDeliveryAt: string | null;
    lastDeliveryOk: boolean | null;
    apiKeyConfigured: boolean;
  };
  activity: Array<{
    id: string;
    channel: "push" | "email" | "system_email" | "announcements" | "whatsapp";
    kind: "sent" | "scheduled" | "draft" | "connected";
    title: string;
    detail: string;
    at: string;
    href: string;
  }>;
};

export const MESSENGER_HREF = "/admin/marketing/messenger";
export const INTEGRATIONS_HREF = "/admin/marketing/integrations";
export const AUDIT_HREF = "/admin/audit";

export function formatCompactCount(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  }
  return String(value);
}

export function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const deltaMs = Date.now() - date.getTime();
  const minutes = Math.round(deltaMs / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function formatLastPing(iso: string | null): string {
  if (!iso) return "No deliveries yet";
  return `Last ping: ${formatRelativeTime(iso)}`;
}
