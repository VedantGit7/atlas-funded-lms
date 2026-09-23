import { withTenantTx, type TenantTx } from "@atlas/db";
import {
  REPORT_DELIVERY_WORKER_DESTINATION,
  REPORT_RUN_SUCCEEDED_EVENT,
  reportRunSucceededPayloadSchema,
} from "@atlas/domain/reports/reports.events";
import { deliverSucceededReportRun } from "@atlas/domain/reports/reports-delivery";
import { reportsRepository } from "@atlas/domain/reports/reports.repository";
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
  const tenantId = event.tenantId;

  const payload = reportRunSucceededPayloadSchema.parse(event.payload);
  const emailProvider = getEmailProvider();

  const withTx = <T>(fn: (tx: TenantTx) => Promise<T>) =>
    withTenantTx({ tenantId, requestId: event.requestId, allowAnonymousTenantRead: true }, fn);
  const run = await withTx((tx) => reportsRepository.findReportRunById(tx, payload.reportRunId));
  const actorMembershipId = run?.requested_by_membership_id;
  if (!actorMembershipId)
    throw new Error("Report delivery requires the schedule/run owner membership.");
  await deliverSucceededReportRun(
    withTx,
    { tenantId, actorMembershipId, requestId: event.requestId },
    {
      reportRunId: payload.reportRunId,
      emailSupportsIdempotency: emailProvider.supportsIdempotency === true,
      sendEmail: emailProvider.isConfigured()
        ? async (input) => {
            await emailProvider.send({ ...input, tenantId });
          }
        : null,
      resolveMembershipEmail: (tx, membershipId) =>
        notificationRepository.findMembershipEmail(tx, membershipId),
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
