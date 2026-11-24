import { z } from "zod";
import type { TenantTx } from "@atlas/db";
import { outbox } from "@atlas/events";
import {
  OutboxDeliveryError,
  type OutboxHandler,
} from "@atlas/events/services/outbox-worker.service";
import { getTenantBranding } from "@atlas/domain-branding/repositories/branding.repository";
import { channelSender, getEmailProvider } from "../notifications/notification.email-provider";
import { escapeHtml } from "../notifications/security-notification.templates";
import {
  readTenantDefaultTimezone,
  readTenantEmailChannel,
} from "../tenant-settings/tenant-settings.service";
import { formatEventWhen } from "./marketing-event-time";
import type { MarketingEventRow } from "./marketing-events.repository";

/**
 * Event emails: the confirmation sent when someone registers, and the reminder
 * the admin chose ("1 hour before"). QA review 2 H29: the event page said
 * "Check your email" and no email was ever sent; the reminder setting was saved
 * and never acted on.
 *
 * Both are transactional (the person asked to be registered), so they go from
 * the academy's transactional sender and are not stopped by the
 * marketing-email switch.
 */
export const MARKETING_EVENT_EMAIL_REQUESTED_EVENT = "marketing.event_email_requested";
export const MARKETING_EVENT_EMAIL_DESTINATION = "marketing.event.email";

export type MarketingEventEmailKind = "confirmation" | "reminder";

export const marketingEventEmailPayloadSchema = z
  .object({
    kind: z.enum(["confirmation", "reminder"]),
    eventId: z.uuid(),
    registrationId: z.uuid(),
    idempotencyKey: z.string().min(1).max(200),
    to: z.email(),
    subject: z.string().min(1).max(300),
    body: z.string().min(1).max(100_000),
    fromName: z.string(),
    fromEmail: z.string(),
    replyToEmail: z.string().nullable(),
  })
  .strict();

const DEFAULT_ACADEMY_NAME = "Your academy";

export function buildMarketingEventEmail(args: {
  kind: MarketingEventEmailKind;
  academyName: string | null;
  recipientName: string | null;
  event: Pick<
    MarketingEventRow,
    "id" | "title" | "starts_at" | "ends_at" | "location" | "join_url"
  >;
  timeZone: string;
  /** The academy's site, for the "View event" link. Null leaves the link out. */
  siteUrl: string | null;
}): { subject: string; html: string } {
  const academy = args.academyName?.trim() || DEFAULT_ACADEMY_NAME;
  const title = args.event.title;
  const when = formatEventWhen(args.event.starts_at, args.event.ends_at, args.timeZone);
  const subject =
    args.kind === "confirmation" ? `You're registered: ${title}` : `Starting soon: ${title}`;
  const greeting = args.recipientName?.trim() ? `Hi ${args.recipientName.trim()},` : "Hi,";
  const intro =
    args.kind === "confirmation"
      ? `You're registered for ${title}. Here are the details.`
      : `This is your reminder: ${title} starts soon.`;

  const eventUrl = args.siteUrl
    ? `${args.siteUrl.replace(/\/$/, "")}/events/${encodeURIComponent(args.event.id)}`
    : null;
  const buttonUrl = args.event.join_url ?? eventUrl;
  const buttonLabel = args.event.join_url ? "Join the event" : "View the event";

  const row = (label: string, value: string) =>
    `<tr><td style="padding:6px 16px 6px 0;font-size:14px;color:#64748b;vertical-align:top;white-space:nowrap;">${escapeHtml(label)}</td><td style="padding:6px 0;font-size:15px;color:#0f172a;">${escapeHtml(value)}</td></tr>`;

  const details = [
    row("When", when),
    args.event.location ? row("Where", args.event.location) : "",
  ].join("");

  const button = buttonUrl
    ? `<a href="${escapeHtml(buttonUrl)}" style="display:inline-block;margin-top:24px;background:#0f172a;color:#ffffff;font-size:15px;font-weight:700;line-height:48px;padding:0 28px;border-radius:10px;text-decoration:none;">${escapeHtml(buttonLabel)}</a>`
    : "";
  const joinNote =
    args.event.join_url && eventUrl
      ? `<p style="margin:20px 0 0;font-size:13px;line-height:1.6;color:#64748b;">Event page: <a href="${escapeHtml(eventUrl)}" style="color:#334155;">${escapeHtml(eventUrl)}</a></p>`
      : "";

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:40px 16px;background:#f1f5f9;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;">
    <tr><td style="background:#0f172a;padding:28px 40px;color:#ffffff;font-size:20px;font-weight:700;">${escapeHtml(academy)}</td></tr>
    <tr><td style="padding:36px 40px;">
      <p style="margin:0 0 12px;font-size:16px;color:#334155;">${escapeHtml(greeting)}</p>
      <p style="margin:0 0 20px;font-size:16px;line-height:1.6;color:#334155;">${escapeHtml(intro)}</p>
      <h1 style="margin:0 0 12px;font-size:24px;line-height:1.3;color:#0f172a;">${escapeHtml(title)}</h1>
      <table role="presentation" cellpadding="0" cellspacing="0">${details}</table>
      ${button}
      ${joinNote}
    </td></tr>
  </table>
</body>
</html>`;

  return { subject, html };
}

/**
 * Queues one event email in the same transaction as the change that caused it,
 * so a registration that commits always has its confirmation queued.
 */
export async function queueMarketingEventEmail(
  tx: TenantTx,
  ctx: { tenantId: string; requestId: string; actorMembershipId?: string | null },
  args: {
    kind: MarketingEventEmailKind;
    event: MarketingEventRow;
    registration: { id: string; email: string; name: string | null };
    siteUrl: string | null;
  },
): Promise<void> {
  const [branding, timeZone, channel] = await Promise.all([
    getTenantBranding(tx),
    readTenantDefaultTimezone(tx),
    readTenantEmailChannel(tx, "transactionalEmail"),
  ]);
  const { subject, html } = buildMarketingEventEmail({
    kind: args.kind,
    academyName: branding ? (branding.public_name ?? branding.display_name) : null,
    recipientName: args.registration.name,
    event: args.event,
    timeZone,
    siteUrl: args.siteUrl,
  });
  const idempotencyKey = `marketing.event_email:${args.kind}:${args.registration.id}`;
  await outbox.publish(tx, {
    ctx: {
      tenantId: ctx.tenantId,
      actorMembershipId: ctx.actorMembershipId ?? null,
      requestId: ctx.requestId,
    },
    eventType: MARKETING_EVENT_EMAIL_REQUESTED_EVENT,
    aggregateType: "marketing_event_registration",
    aggregateId: args.registration.id,
    idempotencyKey,
    payload: marketingEventEmailPayloadSchema.parse({
      kind: args.kind,
      eventId: args.event.id,
      registrationId: args.registration.id,
      idempotencyKey,
      to: args.registration.email,
      subject,
      body: html,
      fromName: channel.fromName,
      fromEmail: channel.fromEmail,
      replyToEmail: channel.replyToEmail,
    }),
  });
}

export const handleMarketingEventEmailOutboxEvent: OutboxHandler["handle"] = async (event) => {
  if (event.eventType !== MARKETING_EVENT_EMAIL_REQUESTED_EVENT) return;
  if (!event.tenantId) throw new OutboxDeliveryError("permanent", "EVENT_EMAIL_TENANT_REQUIRED");
  const payload = marketingEventEmailPayloadSchema.parse(event.payload);

  const provider = getEmailProvider();
  if (!provider.isConfigured())
    throw new OutboxDeliveryError("permanent", "EMAIL_PROVIDER_NOT_CONFIGURED");
  try {
    await provider.send({
      tenantId: event.tenantId,
      to: payload.to,
      subject: payload.subject,
      body: payload.body,
      requestId: event.requestId,
      idempotencyKey: payload.idempotencyKey,
      ...channelSender({ fromName: payload.fromName, fromEmail: payload.fromEmail }),
      replyToEmail: payload.replyToEmail,
    });
  } catch (error) {
    if (error instanceof OutboxDeliveryError) throw error;
    // The provider may have accepted it; a retry could send it twice.
    throw new OutboxDeliveryError("reconciliation_required", "EVENT_EMAIL_ACCEPTANCE_UNKNOWN");
  }
};

export const marketingEventEmailOutboxHandlers: OutboxHandler[] = [
  {
    destinationKey: MARKETING_EVENT_EMAIL_DESTINATION,
    // At most once: a crash mid-send must not email the person twice.
    retryOnCrash: false,
    handle: handleMarketingEventEmailOutboxEvent,
  },
];
