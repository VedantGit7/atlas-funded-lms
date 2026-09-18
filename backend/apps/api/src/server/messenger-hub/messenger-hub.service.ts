import type { TenantTx } from "@atlas/db";
import type { ServiceCtx } from "@atlas/domain/shared/domain.types";
import { SYSTEM_EMAIL_CATALOG } from "../system-email/system-email.catalog";
import { notificationRepository } from "../notifications/notification.repository";
import { messengerHubRepository } from "./messenger-hub.repository";
import {
  messengerHubSummaryResponseSchema,
  type messengerHubSummaryDtoSchema,
} from "./messenger-hub.schemas";
import type { z } from "zod";

type HubSummary = z.infer<typeof messengerHubSummaryDtoSchema>;

const LOCALE = "en";
const CHANNEL = "email";

function activityHref(channel: HubSummary["activity"][number]["channel"], id: string): string {
  switch (channel) {
    case "email":
      return `/admin/marketing/messenger/email/${id}`;
    case "push":
      return `/admin/marketing/messenger/push/${id}`;
    case "announcements":
      return `/admin/marketing/messenger/announcements`;
    case "whatsapp":
      return `/admin/marketing/messenger/whatsapp/${id}`;
    case "system_email":
      return `/admin/marketing/messenger/system-email`;
    default:
      return "/admin/marketing/messenger";
  }
}

async function countEnabledSystemEmails(tx: TenantTx, tenantId: string) {
  let enabledCount = 0;
  for (const entry of SYSTEM_EMAIL_CATALOG) {
    const override = await notificationRepository.findTemplateByUniqueKey(tx, {
      tenantId,
      key: entry.key,
      channel: CHANNEL,
      locale: LOCALE,
    });
    const enabled = !(override?.status === "INACTIVE" || override?.status === "ARCHIVED");
    if (enabled) enabledCount += 1;
  }
  return enabledCount;
}

export async function getMessengerHubSummary(tx: TenantTx, ctx: ServiceCtx) {
  const [
    emailCounts,
    pushCounts,
    whatsappCounts,
    announcementCounts,
    weeklySent,
    latestTitle,
    whatsappStatus,
    webhookSummary,
    apiKeyConfigured,
    activityRows,
    enabledSystemEmails,
  ] = await Promise.all([
    messengerHubRepository.emailCounts(tx),
    messengerHubRepository.pushCounts(tx),
    messengerHubRepository.whatsappCounts(tx),
    messengerHubRepository.announcementCounts(tx),
    messengerHubRepository.emailWeeklySent(tx),
    messengerHubRepository.latestEmailTitle(tx),
    messengerHubRepository.whatsappConnectionStatus(tx),
    messengerHubRepository.webhookSummary(tx),
    messengerHubRepository.credentialsSummary(tx),
    messengerHubRepository.recentActivity(tx, 8),
    countEnabledSystemEmails(tx, ctx.tenantId),
  ]);

  const lastDeliveryStatus = webhookSummary.last_delivery_status;
  const lastDeliveryOk = lastDeliveryStatus == null ? null : lastDeliveryStatus.startsWith("ok");

  const summary: HubSummary = {
    email: {
      activeCount: emailCounts.draft_count + emailCounts.scheduled_count,
      scheduledCount: emailCounts.scheduled_count,
      draftCount: emailCounts.draft_count,
      sentCount: emailCounts.sent_count,
      totalReach: emailCounts.total_reach,
      weeklySent,
      latestTitle,
    },
    push: {
      activeCount: pushCounts.draft_count + pushCounts.scheduled_count,
      sentCount: pushCounts.sent_count,
      totalReach: pushCounts.total_reach,
    },
    systemEmail: {
      enabledCount: enabledSystemEmails,
      totalCount: SYSTEM_EMAIL_CATALOG.length,
    },
    announcements: {
      sentCount: announcementCounts.sent_count,
      totalReach: announcementCounts.total_reach,
    },
    whatsapp: {
      connectionStatus: whatsappStatus,
      activeCount: whatsappCounts.draft_count + whatsappCounts.scheduled_count,
      sentCount: whatsappCounts.sent_count,
    },
    integrations: {
      webhookCount: webhookSummary.webhook_count,
      webhookEnabledCount: webhookSummary.webhook_enabled_count,
      lastDeliveryAt: webhookSummary.last_delivery_at?.toISOString() ?? null,
      lastDeliveryOk,
      apiKeyConfigured,
    },
    activity: activityRows.map((row) => {
      const kind =
        row.kind === "sent" || row.kind === "scheduled" || row.kind === "draft"
          ? row.kind
          : "draft";
      return {
        id: `${row.channel}:${row.id}`,
        channel: row.channel,
        kind,
        title: row.title,
        detail: row.detail,
        at: row.at.toISOString(),
        href: activityHref(row.channel, row.id),
      };
    }),
  };

  return messengerHubSummaryResponseSchema.parse({ data: summary });
}
