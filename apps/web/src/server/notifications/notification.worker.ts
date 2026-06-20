import { withTenantTx } from "@atlas/db";
import {
  buildNotificationIdempotencyKey,
  notificationQueuedOutboxPayloadSchema,
} from "./notification.dto";
import { getEmailProvider } from "./notification.email-provider";
import {
  CERTIFICATE_ISSUED_EVENT,
  CERTIFICATE_REVOKED_EVENT,
} from "../certificates/certificate.events";
import {
  NOTIFICATION_QUEUED_EVENT,
  certificateIssuedOutboxPayloadSchema,
  certificateRevokedOutboxPayloadSchema,
} from "./notification.events";
import { notificationRepository } from "./notification.repository";
import {
  buildRenderedTemplateContent,
  buildSafeInboxPayload,
  publishNotificationQueuedEvent,
} from "./notification.service";
import type { ServiceCtx } from "./notification.types";

export const NOTIFICATION_SOURCE_WORKER_DESTINATION = "notifications.source";
export const NOTIFICATION_QUEUED_WORKER_DESTINATION = "notifications.queued";

const SOURCE_EVENT_TYPES = [CERTIFICATE_ISSUED_EVENT, CERTIFICATE_REVOKED_EVENT] as const;

async function extractRecipientMembershipId(
  tx: Parameters<typeof notificationRepository.insertDispatch>[0],
  eventType: string,
  payload: Record<string, unknown>,
): Promise<string | null> {
  if (eventType === CERTIFICATE_ISSUED_EVENT) {
    const parsed = certificateIssuedOutboxPayloadSchema.safeParse(payload);
    return parsed.success ? parsed.data.membershipId : null;
  }

  if (eventType === CERTIFICATE_REVOKED_EVENT) {
    const parsed = certificateRevokedOutboxPayloadSchema.safeParse(payload);
    if (!parsed.success) return null;
    return notificationRepository.findCertificateMembershipId(tx, parsed.data.certificateId);
  }

  return null;
}

export async function processNotificationSourceEvent(
  tx: Parameters<typeof notificationRepository.insertDispatch>[0],
  ctx: ServiceCtx,
  event: { id: string; eventType: string; payload: unknown },
): Promise<void> {
  if (event.eventType === NOTIFICATION_QUEUED_EVENT) {
    return;
  }

  if (!SOURCE_EVENT_TYPES.includes(event.eventType as (typeof SOURCE_EVENT_TYPES)[number])) {
    return;
  }

  const payload = event.payload as Record<string, unknown>;
  const membershipId = await extractRecipientMembershipId(tx, event.eventType, payload);
  if (!membershipId) {
    return;
  }

  const templates = await notificationRepository.listActiveTemplatesForEvent(tx, {
    tenantId: ctx.tenantId,
    key: event.eventType,
    locale: "en",
  });

  for (const template of templates) {
    const idempotencyKey = buildNotificationIdempotencyKey({
      sourceEventId: event.id,
      templateId: template.id,
      recipientMembershipId: membershipId,
      channel: template.channel,
    });

    const existing = await notificationRepository.findDispatchByIdempotencyKey(tx, {
      tenantId: ctx.tenantId,
      idempotencyKey,
    });
    if (existing) {
      continue;
    }

    const rendered = buildRenderedTemplateContent(template, event.eventType, payload);

    if (template.channel === "in_app") {
      const dispatch = await notificationRepository.insertDispatch(tx, {
        tenantId: ctx.tenantId,
        membershipId,
        channel: template.channel,
        templateKey: template.key,
        destination: null,
        idempotencyKey,
        status: "SENT",
        payloadJson: buildSafeInboxPayload({
          title: rendered.title,
          body: rendered.body,
          actionPath: rendered.actionPath,
        }),
        sentAt: new Date(),
      });

      await publishNotificationQueuedEvent(tx, ctx, {
        dispatchId: dispatch.id,
        channel: template.channel,
        templateId: template.id,
        templateKey: template.key,
        membershipId,
        sourceEventId: event.id,
      });
      continue;
    }

    await publishNotificationQueuedEvent(tx, ctx, {
      channel: template.channel,
      templateId: template.id,
      templateKey: template.key,
      membershipId,
      sourceEventId: event.id,
      renderedPayload: rendered,
    });
  }
}

export async function processNotificationQueuedEvent(
  tx: Parameters<typeof notificationRepository.insertDispatch>[0],
  ctx: ServiceCtx,
  payload: unknown,
): Promise<void> {
  const parsed = notificationQueuedOutboxPayloadSchema.parse(payload);

  if (parsed.channel === "in_app") {
    if (!parsed.dispatchId) {
      return;
    }

    const dispatch = await notificationRepository.findDispatchById(tx, parsed.dispatchId);
    if (!dispatch || dispatch.tenant_id !== ctx.tenantId || dispatch.status === "SENT") {
      return;
    }
    return;
  }

  const idempotencyKey = buildNotificationIdempotencyKey({
    sourceEventId: parsed.sourceEventId,
    templateId: parsed.templateId,
    recipientMembershipId: parsed.membershipId,
    channel: parsed.channel,
  });

  const existing = await notificationRepository.findDispatchByIdempotencyKey(tx, {
    tenantId: ctx.tenantId,
    idempotencyKey,
  });
  if (existing) {
    return;
  }

  const rendered = parsed.renderedPayload;
  if (!rendered) {
    throw new Error("Email notification queued event missing rendered payload.");
  }

  const to = await notificationRepository.findMembershipEmail(tx, parsed.membershipId);
  const emailProvider = getEmailProvider();

  if (!to) {
    await notificationRepository.insertDispatch(tx, {
      tenantId: ctx.tenantId,
      membershipId: parsed.membershipId,
      channel: parsed.channel,
      templateKey: parsed.templateKey,
      destination: null,
      idempotencyKey,
      status: "FAILED",
      payloadJson: {
        email: {
          subject: rendered.emailSubject ?? rendered.title,
          body: rendered.body,
        },
      },
    });
    throw new Error("Notification email destination missing.");
  }

  if (!emailProvider.isConfigured()) {
    await notificationRepository.insertDispatch(tx, {
      tenantId: ctx.tenantId,
      membershipId: parsed.membershipId,
      channel: parsed.channel,
      templateKey: parsed.templateKey,
      destination: to,
      idempotencyKey,
      status: "FAILED",
      payloadJson: {
        email: {
          subject: rendered.emailSubject ?? rendered.title,
          body: rendered.body,
        },
      },
    });
    throw new Error("EMAIL_PROVIDER_NOT_CONFIGURED");
  }

  await emailProvider.send({
    to,
    subject: rendered.emailSubject ?? rendered.title,
    body: rendered.body,
    requestId: ctx.requestId,
  });

  await notificationRepository.insertDispatch(tx, {
    tenantId: ctx.tenantId,
    membershipId: parsed.membershipId,
    channel: parsed.channel,
    templateKey: parsed.templateKey,
    destination: to,
    idempotencyKey,
    status: "SENT",
    payloadJson: {
      email: {
        subject: rendered.emailSubject ?? rendered.title,
        body: rendered.body,
      },
    },
    sentAt: new Date(),
  });
}

export async function handleNotificationSourceOutboxEvent(event: {
  id: string;
  eventType: string;
  tenantId: string | null;
  payload: unknown;
  requestId: string;
}): Promise<void> {
  if (event.tenantId == null) {
    throw new Error("Notification source worker requires tenant-scoped events.");
  }

  const tenantId = event.tenantId;

  if (event.eventType === NOTIFICATION_QUEUED_EVENT) {
    return;
  }

  await withTenantTx(
    {
      tenantId,
      requestId: event.requestId,
      allowAnonymousTenantRead: true,
    },
    async (tx) => {
      await processNotificationSourceEvent(
        tx,
        {
          tenantId,
          actorMembershipId: "00000000-0000-0000-0000-000000000000",
          requestId: event.requestId,
        },
        event,
      );
    },
  );
}

export async function handleNotificationQueuedOutboxEvent(event: {
  id: string;
  eventType: string;
  tenantId: string | null;
  payload: unknown;
  requestId: string;
}): Promise<void> {
  if (event.tenantId == null) {
    throw new Error("Notification queued worker requires tenant-scoped events.");
  }

  const tenantId = event.tenantId;

  if (event.eventType !== NOTIFICATION_QUEUED_EVENT) {
    return;
  }

  await withTenantTx(
    {
      tenantId,
      requestId: event.requestId,
      allowAnonymousTenantRead: true,
    },
    async (tx) => {
      await processNotificationQueuedEvent(
        tx,
        {
          tenantId,
          actorMembershipId: "00000000-0000-0000-0000-000000000000",
          requestId: event.requestId,
        },
        event.payload,
      );
    },
  );
}

export const notificationSourceOutboxHandlers = [
  {
    destinationKey: NOTIFICATION_SOURCE_WORKER_DESTINATION,
    handle: handleNotificationSourceOutboxEvent,
  },
];

export const notificationQueuedOutboxHandlers = [
  {
    destinationKey: NOTIFICATION_QUEUED_WORKER_DESTINATION,
    handle: handleNotificationQueuedOutboxEvent,
  },
];

export async function processNotificationOutboxBatch(args: {
  tenantId: string;
  requestId: string;
  limit?: number;
  maxRetries?: number;
}): Promise<{ processed: number; delivered: number; failed: number; skipped: number }> {
  const { processOutboxBatch } = await import("@atlas/events/services/outbox-worker.service");
  const { createNotificationOutboxConsumers } = await import("../../events/outbox-consumers");

  return withTenantTx(
    {
      tenantId: args.tenantId,
      requestId: args.requestId,
      allowAnonymousTenantRead: true,
    },
    async (tx) =>
      processOutboxBatch(tx, {
        limit: args.limit ?? 25,
        maxRetries: args.maxRetries ?? 3,
        handlers: createNotificationOutboxConsumers(),
      }),
  );
}
