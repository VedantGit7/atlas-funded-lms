import { buildNotificationIdempotencyKey } from "./notification.keys";
import { withTenantTx } from "@atlas/db";
import { OutboxDeliveryError } from "@atlas/events/services/outbox-worker.service";
import {
  getMemberPreferences,
  isMemberOptedOutOfCategory,
  isMemberOptedOutOfChannel,
} from "@atlas/membership";
import type { NotificationPreferenceCategory } from "@atlas/membership";
import { notificationQueuedOutboxPayloadSchema } from "./notification.dto";
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
import {
  SECURITY_NOTIFICATION_EVENT_KEYS,
  securityNotificationOutboxPayloadSchema,
  type SecurityNotificationEventKey,
} from "./security-notification.events";
import {
  buildSecurityEmailHtml,
  getBuiltInSecurityTemplate,
} from "./security-notification.templates";
import { notificationRepository } from "./notification.repository";
import {
  buildRenderedTemplateContent,
  buildSafeInboxPayload,
  publishNotificationQueuedEvent,
} from "./notification.service";
import type { ServiceCtx } from "./notification.types";
import { resolveSystemEmailForSend } from "../system-email/system-email.service";
import { readTenantEmailChannel } from "../tenant-settings/tenant-settings.service";
import { readTenantBranding } from "@atlas/domain-branding/services/branding-read.service";
import type { NotificationTemplateRow } from "./notification.types";
import { localeRepository } from "../locales/locale.repository";

export const NOTIFICATION_SOURCE_WORKER_DESTINATION = "notifications.source";
export const NOTIFICATION_QUEUED_WORKER_DESTINATION = "notifications.queued";

const SOURCE_EVENT_TYPES = [CERTIFICATE_ISSUED_EVENT, CERTIFICATE_REVOKED_EVENT] as const;

const SECURITY_BUILTIN_TEMPLATE_IDS: Record<SecurityNotificationEventKey, string> = {
  "security.password_changed": "00000000-0000-4000-8000-000000000001",
  "security.email_changed": "00000000-0000-4000-8000-000000000002",
  "security.phone_changed": "00000000-0000-4000-8000-000000000003",
  "security.signin_method_linked": "00000000-0000-4000-8000-000000000004",
  "security.signin_method_removed": "00000000-0000-4000-8000-000000000005",
  "security.mfa_enabled": "00000000-0000-4000-8000-000000000006",
  "security.mfa_disabled": "00000000-0000-4000-8000-000000000007",
};

function isSecurityEventType(eventType: string): eventType is SecurityNotificationEventKey {
  return (SECURITY_NOTIFICATION_EVENT_KEYS as readonly string[]).includes(eventType);
}

async function processSecurityNotificationSourceEvent(
  tx: Parameters<typeof notificationRepository.insertDispatch>[0],
  ctx: ServiceCtx,
  event: { id: string; eventType: SecurityNotificationEventKey; payload: unknown },
): Promise<void> {
  const parsed = securityNotificationOutboxPayloadSchema.safeParse(event.payload);
  if (!parsed.success) {
    return;
  }

  const { membershipId, email, siteUrl } = parsed.data;
  const builtIn = getBuiltInSecurityTemplate(event.eventType);
  const templateId = SECURITY_BUILTIN_TEMPLATE_IDS[event.eventType];
  const systemEmail = await resolveSystemEmailForSend(tx, ctx.tenantId, event.eventType);

  if (
    await isOptedOutOfCategory(tx, {
      tenantId: ctx.tenantId,
      membershipId,
      category: event.eventType,
    })
  ) {
    return;
  }

  const rendered = {
    title: systemEmail?.title ?? builtIn.title,
    body: systemEmail?.body ?? builtIn.body,
    actionPath: systemEmail?.actionPath ?? builtIn.actionPath,
    emailSubject: systemEmail?.subject ?? builtIn.emailSubject,
  };

  const inAppOptedOut = await isMemberOptedOutOfChannel({
    tx,
    tenantId: ctx.tenantId,
    membershipId,
    category: event.eventType,
    channel: "in_app",
  });

  if (!inAppOptedOut) {
    const inAppIdempotencyKey = buildNotificationIdempotencyKey({
      sourceEventId: event.id,
      templateId,
      recipientMembershipId: membershipId,
      channel: "in_app",
    });

    const existingInApp = await notificationRepository.findDispatchByIdempotencyKey(tx, {
      tenantId: ctx.tenantId,
      idempotencyKey: inAppIdempotencyKey,
    });

    if (!existingInApp) {
      const dispatch = await notificationRepository.insertDispatch(tx, {
        tenantId: ctx.tenantId,
        membershipId,
        channel: "in_app",
        templateKey: event.eventType,
        destination: null,
        idempotencyKey: inAppIdempotencyKey,
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
        channel: "in_app",
        templateId,
        templateKey: event.eventType,
        membershipId,
        sourceEventId: event.id,
      });
    }
  }

  const emailOptedOut = await isMemberOptedOutOfChannel({
    tx,
    tenantId: ctx.tenantId,
    membershipId,
    category: event.eventType,
    channel: "email",
  });

  if (!emailOptedOut && systemEmail?.enabled !== false) {
    // Security emails are sent on behalf of the tenant, so they must carry the
    // tenant's own name. Every tenant's security email previously said
    // "FundedBeyond Academy" because the brand was baked into the template.
    const branding = await readTenantBranding(tx);

    const emailHtml = buildSecurityEmailHtml({
      eventType: event.eventType,
      email,
      siteUrl: siteUrl ?? "https://example.com",
      // publicName is the outward-facing name; displayName is the internal one.
      academyName: branding.data.publicName ?? branding.data.displayName,
      title: rendered.title,
      body: rendered.body,
      emailSubject: rendered.emailSubject,
      actionPath: rendered.actionPath,
    });

    await publishNotificationQueuedEvent(tx, ctx, {
      channel: "email",
      templateId: systemEmail?.templateId ?? templateId,
      templateKey: event.eventType,
      membershipId,
      sourceEventId: event.id,
      renderedPayload: {
        ...rendered,
        body: emailHtml,
      },
    });
  }
}

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

async function isOptedOutOfCategory(
  tx: Parameters<typeof notificationRepository.insertDispatch>[0],
  args: { tenantId: string; membershipId: string; category: NotificationPreferenceCategory },
): Promise<boolean> {
  return isMemberOptedOutOfCategory({
    tx,
    tenantId: args.tenantId,
    membershipId: args.membershipId,
    category: args.category,
  });
}

async function resolveRecipientLocale(
  tx: Parameters<typeof notificationRepository.insertDispatch>[0],
  args: { tenantId: string; membershipId: string; requestId: string },
): Promise<string> {
  const prefs = await getMemberPreferences(tx, {
    tenantId: args.tenantId,
    actorMembershipId: args.membershipId,
    requestId: args.requestId,
  });
  if (prefs.data.locale) {
    return prefs.data.locale;
  }

  return localeRepository.getTenantDefaultLocale(tx, args.tenantId);
}

export async function processNotificationSourceEvent(
  tx: Parameters<typeof notificationRepository.insertDispatch>[0],
  ctx: ServiceCtx,
  event: { id: string; eventType: string; payload: unknown },
): Promise<void> {
  if (event.eventType === NOTIFICATION_QUEUED_EVENT) {
    return;
  }

  if (isSecurityEventType(event.eventType)) {
    await processSecurityNotificationSourceEvent(tx, ctx, {
      id: event.id,
      eventType: event.eventType,
      payload: event.payload,
    });
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

  if (
    await isOptedOutOfCategory(tx, {
      tenantId: ctx.tenantId,
      membershipId,
      category: event.eventType as NotificationPreferenceCategory,
    })
  ) {
    return;
  }

  const locale = await resolveRecipientLocale(tx, {
    tenantId: ctx.tenantId,
    membershipId,
    requestId: ctx.requestId,
  });

  let templates = await notificationRepository.listActiveTemplatesForEvent(tx, {
    tenantId: ctx.tenantId,
    key: event.eventType,
    locale,
  });

  // Learnyst System Email defaults: ensure an email template is available when
  // the catalog entry is enabled and no ACTIVE email template exists yet.
  const hasEmailTemplate = templates.some((template) => template.channel === "email");
  if (!hasEmailTemplate) {
    const systemEmail = await resolveSystemEmailForSend(tx, ctx.tenantId, event.eventType);
    if (systemEmail?.enabled) {
      const now = new Date();
      const virtual: NotificationTemplateRow = {
        id: systemEmail.templateId ?? "00000000-0000-4000-8000-0000000000c1",
        tenant_id: ctx.tenantId,
        key: event.eventType,
        channel: "email",
        locale,
        subject: systemEmail.subject,
        body: systemEmail.body,
        variables_json: { variables: [] },
        status: "ACTIVE",
        created_at: now,
        updated_at: now,
      };
      templates = [...templates, virtual];
    }
  }

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

    if (
      await isMemberOptedOutOfChannel({
        tx,
        tenantId: ctx.tenantId,
        membershipId,
        category: event.eventType as NotificationPreferenceCategory,
        channel: template.channel as "email" | "in_app",
      })
    ) {
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
  db: {
    transaction: <T>(
      fn: (tx: Parameters<typeof notificationRepository.insertDispatch>[0]) => Promise<T>,
    ) => Promise<T>;
  },
  ctx: ServiceCtx,
  payload: unknown,
): Promise<void> {
  const result = notificationQueuedOutboxPayloadSchema.safeParse(payload);
  if (!result.success) throw new OutboxDeliveryError("permanent", "NOTIFICATION_PAYLOAD_INVALID");
  const parsed = result.data;
  if (parsed.channel === "in_app") return;

  const idempotencyKey = buildNotificationIdempotencyKey({
    sourceEventId: parsed.sourceEventId,
    templateId: parsed.templateId,
    recipientMembershipId: parsed.membershipId,
    channel: parsed.channel,
  });
  const prepared = await db.transaction(async (tx) => {
    const existing = await notificationRepository.findDispatchByIdempotencyKey(tx, {
      tenantId: ctx.tenantId,
      idempotencyKey,
    });
    if (existing?.status === "SENT") return null;
    if (existing?.status === "FAILED") {
      throw new OutboxDeliveryError("permanent", "NOTIFICATION_DISPATCH_FAILED");
    }
    if (existing) {
      throw new OutboxDeliveryError("reconciliation_required", "NOTIFICATION_DISPATCH_UNKNOWN");
    }
    const rendered = parsed.renderedPayload;
    if (!rendered)
      throw new OutboxDeliveryError("permanent", "NOTIFICATION_RENDERED_PAYLOAD_MISSING");
    const to = await notificationRepository.findMembershipEmail(tx, parsed.membershipId);
    if (!to) throw new OutboxDeliveryError("permanent", "NOTIFICATION_DESTINATION_MISSING");
    const channel = await readTenantEmailChannel(tx, "transactionalEmail");
    return { to, rendered, channel };
  });
  if (!prepared) return;

  const emailProvider = getEmailProvider();
  if (!emailProvider.isConfigured())
    throw new OutboxDeliveryError("permanent", "EMAIL_PROVIDER_NOT_CONFIGURED");
  try {
    await emailProvider.send({
      tenantId: ctx.tenantId,
      to: prepared.to,
      subject: prepared.rendered.emailSubject ?? prepared.rendered.title,
      body: prepared.rendered.body,
      requestId: ctx.requestId,
      idempotencyKey,
      fromName: prepared.channel.fromName.trim() || "Academy",
      fromEmail: prepared.channel.fromEmail.trim() || "noreply@localhost.test",
      replyToEmail: prepared.channel.replyToEmail,
    });
  } catch (error) {
    if (error instanceof OutboxDeliveryError) throw error;
    throw new OutboxDeliveryError("reconciliation_required", "NOTIFICATION_ACCEPTANCE_UNKNOWN");
  }

  try {
    await db.transaction(async (tx) => {
      await notificationRepository.insertDispatch(tx, {
        tenantId: ctx.tenantId,
        membershipId: parsed.membershipId,
        channel: parsed.channel,
        templateKey: parsed.templateKey,
        destination: prepared.to,
        idempotencyKey,
        status: "SENT",
        payloadJson: {
          email: {
            subject: prepared.rendered.emailSubject ?? prepared.rendered.title,
            body: prepared.rendered.body,
          },
        },
        sentAt: new Date(),
      });
    });
  } catch {
    // SMTP may have accepted the email; retrying a failed receipt write can duplicate it.
    throw new OutboxDeliveryError("reconciliation_required", "NOTIFICATION_RECEIPT_UNKNOWN");
  }
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

  await processNotificationQueuedEvent(
    {
      transaction: (fn) =>
        withTenantTx({ tenantId, requestId: event.requestId, allowAnonymousTenantRead: true }, fn),
    },
    {
      tenantId,
      actorMembershipId: "00000000-0000-0000-0000-000000000000",
      requestId: event.requestId,
    },
    event.payload,
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
    // SMTP cannot deduplicate a crashed send, even with a stable Message-ID.
    retryOnCrash: false,
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
  return processOutboxBatch(
    {
      transaction: (fn) =>
        withTenantTx(
          { tenantId: args.tenantId, requestId: args.requestId, allowAnonymousTenantRead: true },
          fn,
        ),
    },
    {
      limit: args.limit ?? 25,
      maxRetries: args.maxRetries ?? 3,
      handlers: createNotificationOutboxConsumers(),
    },
  );
}
