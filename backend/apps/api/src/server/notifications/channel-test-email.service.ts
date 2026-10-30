import { randomUUID } from "node:crypto";
import { AtlasHttpError } from "@atlas/core/http/errors";
import type { TenantTx } from "@atlas/db";
import { getTenantBranding } from "@atlas/domain-branding/repositories/branding.repository";
import { OutboxDeliveryError } from "@atlas/events/services/outbox-worker.service";
import { readTenantEmailChannel } from "../tenant-settings/tenant-settings.service";
import {
  CHANNEL_TEST_EMAIL_TEMPLATE_ID,
  CHANNEL_TEST_EMAIL_TEMPLATE_KEY,
  type ChannelTestEmailResult,
  type SendChannelTestEmailBody,
} from "./channel-test-email.contract";
import { channelSender, getEmailProvider } from "./notification.email-provider";
import { buildNotificationIdempotencyKey } from "./notification.keys";
import { notificationRepository } from "./notification.repository";
import { publishNotificationQueuedEvent } from "./notification.service";
import type { ServiceCtx } from "./notification.types";
import { NOTIFICATION_QUEUED_WORKER_DESTINATION } from "./notification.worker";
import { DEFAULT_ACADEMY_NAME, escapeHtml } from "./security-notification.templates";

/**
 * What the admin reads when a test fails. The codes come from the SMTP
 * provider (SMTP_<reply>) or the outbox worker; anything else is shown as is.
 */
export function describeEmailFailure(code: string): string {
  if (code === "EMAIL_PROVIDER_NOT_CONFIGURED") {
    return "No email provider is configured on the server.";
  }
  if (code === "SMTP_ACCEPTANCE_UNKNOWN" || code === "SMTP_DEADLINE_EXCEEDED") {
    return "The mail server did not confirm the email. It may still arrive, so check the inbox before trying again.";
  }
  if (code === "NOTIFICATION_DESTINATION_MISSING") {
    return "Your account has no email address to send to.";
  }
  const smtp = /^SMTP_(\d{3})$/.exec(code);
  if (smtp) {
    const reply = Number(smtp[1]);
    return reply >= 500
      ? `The mail server refused the email (SMTP ${reply.toString()}). Check that the From email is a sender your email provider allows, and that the address is right.`
      : `The mail server turned the email away for now (SMTP ${reply.toString()}). Try again in a few minutes.`;
  }
  return `The email could not be sent (${code}).`;
}

function notFound(): AtlasHttpError {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 404,
    message: "Test email not found.",
  });
}

async function requireActorEmail(tx: TenantTx, ctx: ServiceCtx): Promise<string> {
  const email = await notificationRepository.findMembershipEmail(tx, ctx.actorMembershipId);
  if (!email) {
    throw new AtlasHttpError({
      code: "VALIDATION_ERROR",
      status: 400,
      message: "Your account has no email address to send a test to.",
    });
  }
  return email;
}

async function buildTestEmail(tx: TenantTx): Promise<{ subject: string; body: string }> {
  const branding = await getTenantBranding(tx);
  const academyName =
    branding?.public_name?.trim() || branding?.display_name.trim() || DEFAULT_ACADEMY_NAME;
  const name = escapeHtml(academyName);
  return {
    subject: `Test email from ${academyName}`,
    body: [
      `<p>This is a test email from ${name}.</p>`,
      "<p>It was sent from the Transactional Email settings to check that email delivery works. No action is needed.</p>",
    ].join(""),
  };
}

function result(
  args: Omit<ChannelTestEmailResult, "errorCode" | "message"> & { errorCode?: string | null },
): ChannelTestEmailResult {
  const errorCode = args.errorCode ?? null;
  const message =
    args.status === "sent"
      ? args.mode === "direct"
        ? "The mail server accepted the email. Check the inbox, including spam."
        : "The worker sent the email and the mail server accepted it. Check the inbox, including spam."
      : args.status === "queued"
        ? "Waiting for the notification worker to send it."
        : describeEmailFailure(errorCode ?? "DELIVERY_FAILED");
  return { ...args, errorCode, message };
}

export async function sendChannelTestEmail(
  tx: TenantTx,
  ctx: ServiceCtx,
  input: SendChannelTestEmailBody,
): Promise<ChannelTestEmailResult> {
  const testId = randomUUID();
  const content = await buildTestEmail(tx);

  if (input.mode === "queued") {
    const to = await requireActorEmail(tx, ctx);
    await publishNotificationQueuedEvent(tx, ctx, {
      channel: "email",
      templateId: CHANNEL_TEST_EMAIL_TEMPLATE_ID,
      templateKey: CHANNEL_TEST_EMAIL_TEMPLATE_KEY,
      membershipId: ctx.actorMembershipId,
      sourceEventId: testId,
      renderedPayload: {
        title: "Test email",
        body: content.body,
        actionPath: "/",
        emailSubject: content.subject,
      },
    });
    return result({ testId, mode: "queued", to, status: "queued" });
  }

  const provider = getEmailProvider();
  if (!provider.isConfigured()) {
    return result({
      testId,
      mode: "direct",
      to: input.to,
      status: "failed",
      errorCode: "EMAIL_PROVIDER_NOT_CONFIGURED",
    });
  }

  const channel = await readTenantEmailChannel(tx, "transactionalEmail");
  try {
    await provider.send({
      tenantId: ctx.tenantId,
      to: input.to,
      subject: content.subject,
      body: content.body,
      requestId: ctx.requestId,
      idempotencyKey: `channel-test-email:${testId}`,
      ...channelSender(channel),
      replyToEmail: channel.replyToEmail,
    });
  } catch (error) {
    return result({
      testId,
      mode: "direct",
      to: input.to,
      status: "failed",
      errorCode: error instanceof OutboxDeliveryError ? error.code : "SEND_FAILED",
    });
  }
  return result({ testId, mode: "direct", to: input.to, status: "sent" });
}

type DeliveryJobRow = { status: string | null; last_error_code: string | null };

/**
 * Where a queued test stands. Keyed to the requesting admin, so one admin
 * cannot read another's test.
 */
export async function readChannelTestEmail(
  tx: TenantTx,
  ctx: ServiceCtx,
  testId: string,
): Promise<ChannelTestEmailResult> {
  const to = await requireActorEmail(tx, ctx);
  const dispatch = await notificationRepository.findDispatchByIdempotencyKey(tx, {
    tenantId: ctx.tenantId,
    idempotencyKey: buildNotificationIdempotencyKey({
      sourceEventId: testId,
      templateId: CHANNEL_TEST_EMAIL_TEMPLATE_ID,
      recipientMembershipId: ctx.actorMembershipId,
      channel: "email",
    }),
  });
  if (dispatch?.status === "SENT") {
    return result({ testId, mode: "queued", to, status: "sent" });
  }

  // The same key publishNotificationQueuedEvent writes.
  const eventKey = `notification.queued:${testId}:${CHANNEL_TEST_EMAIL_TEMPLATE_ID}:email`;
  const rows = await tx.$queryRaw<DeliveryJobRow[]>`
    select j.status, j.last_error_code
    from outbox_events e
    left join outbox_delivery_jobs j
      on j.outbox_event_id = e.id
      and j.destination_key = ${NOTIFICATION_QUEUED_WORKER_DESTINATION}
    where e.idempotency_key = ${eventKey}
      and e.payload_json->>'membershipId' = ${ctx.actorMembershipId}
    limit 1
  `;
  const row = rows[0];
  if (!row) throw notFound();

  switch (row.status) {
    case "succeeded":
      return result({ testId, mode: "queued", to, status: "sent" });
    case "dead":
    case "reconciliation_required":
    case "cancelled":
      return result({
        testId,
        mode: "queued",
        to,
        status: "failed",
        errorCode: row.last_error_code ?? "DELIVERY_FAILED",
      });
    default:
      // No job yet, or pending, processing or waiting to retry.
      return result({ testId, mode: "queued", to, status: "queued" });
  }
}
