import { withTenantTx } from "@atlas/db";
import {
  OutboxDeliveryError,
  type OutboxHandler,
} from "@atlas/events/services/outbox-worker.service";
import { getEmailProvider } from "../notifications/notification.email-provider";
import { notificationRepository } from "../notifications/notification.repository";
import { buildSafeInboxPayload } from "../notifications/notification.service";
import { marketingWorkflowRepository } from "./marketing-workflow.repository";
import {
  MARKETING_WORKFLOW_EMAIL_REQUESTED_EVENT,
  marketingWorkflowEmailPayloadSchema,
} from "./marketing-workflow-email.events";

export const MARKETING_WORKFLOW_EMAIL_DESTINATION = "marketing.workflow.email";

export const handleMarketingWorkflowEmailOutboxEvent: OutboxHandler["handle"] = async (event) => {
  if (event.eventType !== MARKETING_WORKFLOW_EMAIL_REQUESTED_EVENT) return;
  if (!event.tenantId) throw new OutboxDeliveryError("permanent", "WORKFLOW_EMAIL_TENANT_REQUIRED");
  const tenantId = event.tenantId;
  const payload = marketingWorkflowEmailPayloadSchema.parse(event.payload);
  const scope = { tenantId, requestId: event.requestId, allowAnonymousTenantRead: true };
  const delivered = await withTenantTx(scope, async (tx) => {
    // Contact-only runs have no membership dispatch, so keep a workflow receipt as well.
    if (await marketingWorkflowRepository.hasEmailReceipt(tx, payload.runId, payload.nodeId))
      return true;
    const existing = await notificationRepository.findDispatchByIdempotencyKey(tx, {
      tenantId,
      idempotencyKey: payload.idempotencyKey,
    });
    if (existing?.status === "SENT") return true;
    if (existing?.status === "FAILED")
      throw new OutboxDeliveryError("permanent", "WORKFLOW_EMAIL_DISPATCH_FAILED");
    if (existing)
      throw new OutboxDeliveryError("reconciliation_required", "WORKFLOW_EMAIL_DISPATCH_UNKNOWN");
    return false;
  });
  if (delivered) return;

  const provider = getEmailProvider();
  if (!provider.isConfigured())
    throw new OutboxDeliveryError("permanent", "EMAIL_PROVIDER_NOT_CONFIGURED");
  try {
    await provider.send({
      tenantId,
      to: payload.to,
      subject: payload.subject,
      body: payload.body,
      fromName: payload.fromName,
      fromEmail: payload.fromEmail,
      replyToEmail: payload.replyToEmail,
      requestId: event.requestId,
      idempotencyKey: payload.idempotencyKey,
    });
  } catch (error) {
    if (error instanceof OutboxDeliveryError) throw error;
    throw new OutboxDeliveryError("reconciliation_required", "WORKFLOW_EMAIL_ACCEPTANCE_UNKNOWN");
  }

  try {
    await withTenantTx(scope, async (tx) => {
      if (payload.membershipId) {
        await notificationRepository.insertDispatch(tx, {
          tenantId,
          membershipId: payload.membershipId,
          channel: "email",
          templateKey: "marketing.workflow",
          destination: payload.to,
          idempotencyKey: payload.idempotencyKey,
          status: "SENT",
          payloadJson: {
            ...buildSafeInboxPayload({
              title: payload.subject,
              body: payload.body.replace(/<[^>]+>/g, " ").slice(0, 500),
              actionPath: "/",
            }),
            workflow: {
              runId: payload.runId,
              nodeId: payload.nodeId,
              actionTitle: payload.actionTitle,
            },
          },
          sentAt: new Date(),
        });
      }
      await marketingWorkflowRepository.insertLog(tx, {
        runId: payload.runId,
        nodeId: payload.nodeId,
        nodeType: "action",
        status: "SENT",
        message: "Email sent.",
      });
    });
  } catch {
    throw new OutboxDeliveryError("reconciliation_required", "WORKFLOW_EMAIL_RECEIPT_UNKNOWN");
  }
};

export const marketingWorkflowEmailOutboxHandlers: OutboxHandler[] = [
  {
    destinationKey: MARKETING_WORKFLOW_EMAIL_DESTINATION,
    retryOnCrash: false,
    handle: handleMarketingWorkflowEmailOutboxEvent,
  },
];
