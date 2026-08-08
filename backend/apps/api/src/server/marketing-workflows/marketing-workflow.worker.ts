import type { OutboxHandler } from "@atlas/events/services/outbox-worker.service";
import { withTenantTx } from "@atlas/db";
import { handleMarketingWorkflowOutboxEvent } from "./marketing-workflow.service";

export const MARKETING_WORKFLOW_WORKER_DESTINATION = "marketing.workflow.worker";

const SYSTEM_ACTOR = "00000000-0000-0000-0000-000000000000";

export const MARKETING_WORKFLOW_SOURCE_EVENTS = [
  "membership.created",
  "learning.enrollment.created",
  "assessment.graded",
  "marketing.form_submitted",
] as const;

export async function handleMarketingWorkflowWorkerEvent(event: {
  id: string;
  eventType: string;
  tenantId: string | null;
  payload: unknown;
  requestId: string;
}): Promise<void> {
  if (!event.tenantId) return;
  const payload =
    event.payload && typeof event.payload === "object"
      ? (event.payload as Record<string, unknown>)
      : {};
  await withTenantTx(
    {
      tenantId: event.tenantId,
      requestId: event.requestId,
      allowAnonymousTenantRead: true,
    },
    async (tx) => {
      await handleMarketingWorkflowOutboxEvent(
        tx,
        {
          tenantId: event.tenantId!,
          actorMembershipId: SYSTEM_ACTOR,
          requestId: event.requestId,
        },
        {
          eventType: event.eventType,
          eventId: event.id,
          payload,
        },
      );
    },
  );
}

export const marketingWorkflowOutboxHandlers: OutboxHandler[] = [
  {
    destinationKey: MARKETING_WORKFLOW_WORKER_DESTINATION,
    handle: handleMarketingWorkflowWorkerEvent,
  },
];
