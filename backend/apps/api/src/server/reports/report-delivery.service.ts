import { withTenantTx } from "@atlas/db";
import {
  REPORT_DELIVERY_WORKER_DESTINATION,
  REPORT_RUN_SUCCEEDED_EVENT,
  reportRunSucceededPayloadSchema,
} from "@atlas/domain/reports/reports.events";
import { deliverSucceededReportRun } from "@atlas/domain/reports/reports-delivery";
import type { OutboxHandler } from "@atlas/events";
import { getEmailProvider } from "../notifications/notification.email-provider";
import { notificationRepository } from "../notifications/notification.repository";

export async function handleReportDeliveryOutboxEvent(event: {
  id: string;
  eventType: string;
  tenantId: string | null;
  payload: unknown;
  requestId: string;
}): Promise<void> {
  if (event.eventType !== REPORT_RUN_SUCCEEDED_EVENT) return;
  if (event.tenantId == null) {
    throw new Error("Report delivery requires tenant-scoped events.");
  }

  const payload = reportRunSucceededPayloadSchema.parse(event.payload);
  const emailProvider = getEmailProvider();

  await withTenantTx(
    {
      tenantId: event.tenantId,
      requestId: event.requestId,
      allowAnonymousTenantRead: true,
    },
    async (tx) => {
      await deliverSucceededReportRun(
        tx,
        {
          tenantId: event.tenantId!,
          actorMembershipId: "00000000-0000-0000-0000-000000000000",
          requestId: event.requestId,
        },
        {
          reportRunId: payload.reportRunId,
          sendEmail: emailProvider.isConfigured()
            ? async (input: {
                to: string;
                subject: string;
                body: string;
                requestId: string;
              }) => {
                await emailProvider.send(input);
              }
            : null,
          resolveMembershipEmail: (membershipId: string) =>
            notificationRepository.findMembershipEmail(tx, membershipId),
        },
      );
    },
  );
}

export const reportDeliveryOutboxHandlers: OutboxHandler[] = [
  {
    destinationKey: REPORT_DELIVERY_WORKER_DESTINATION,
    handle: handleReportDeliveryOutboxEvent,
  },
];

export { REPORT_DELIVERY_WORKER_DESTINATION, REPORT_RUN_SUCCEEDED_EVENT };
