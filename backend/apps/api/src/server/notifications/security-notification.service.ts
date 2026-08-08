import type { TenantTx } from "@atlas/db";
import { outbox } from "@atlas/events";
import type { SecurityNotificationEventKey } from "./security-notification.events";
import { securityNotificationOutboxPayloadSchema } from "./security-notification.events";

type ServiceCtx = {
  tenantId: string;
  requestId: string;
};

export async function publishSecurityEvent(
  tx: TenantTx,
  ctx: ServiceCtx,
  args: {
    eventType: SecurityNotificationEventKey;
    membershipId: string;
    email: string;
    siteUrl?: string;
    metadata?: Record<string, string>;
  },
): Promise<void> {
  const payload = securityNotificationOutboxPayloadSchema.parse({
    membershipId: args.membershipId,
    email: args.email,
    ...(args.siteUrl ? { siteUrl: args.siteUrl } : {}),
    ...(args.metadata ? { metadata: args.metadata } : {}),
  });

  await outbox.publish(tx, {
    ctx: {
      tenantId: ctx.tenantId,
      requestId: ctx.requestId,
    },
    eventType: args.eventType,
    aggregateType: "security_notification",
    aggregateId: args.membershipId,
    payload,
    idempotencyKey: `${args.eventType}:${args.membershipId}:${ctx.requestId}`,
  });
}
