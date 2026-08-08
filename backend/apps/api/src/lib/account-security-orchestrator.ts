import type { TenantTx } from "@atlas/db";
import { publishSecurityEvent } from "../server/notifications/security-notification.service";
import type { SecurityNotificationEventKey } from "../server/notifications/security-notification.events";

type ServiceCtx = {
  tenantId: string;
  actorMembershipId: string;
  requestId: string;
};

export async function resolveTenantPublicSiteUrl(
  tx: TenantTx,
  tenantId: string,
): Promise<string> {
  const rows = await tx.$queryRaw<Array<{ hostname: string }>>`
    select hostname
    from tenant_domains
    where tenant_id = ${tenantId}::uuid
      and is_primary = true
      and deleted_at is null
    limit 1
  `;

  const hostname = rows[0]?.hostname;
  if (!hostname) {
    return process.env["PUBLIC_SITE_URL"] ?? "https://fundedbeyond.com";
  }

  return `https://${hostname}`;
}

export async function emitSecurityNotification(
  tx: TenantTx,
  ctx: ServiceCtx,
  args: {
    eventType: SecurityNotificationEventKey;
    email: string;
    siteUrl?: string;
  },
): Promise<void> {
  const siteUrl = args.siteUrl ?? (await resolveTenantPublicSiteUrl(tx, ctx.tenantId));

  await publishSecurityEvent(tx, ctx, {
    eventType: args.eventType,
    membershipId: ctx.actorMembershipId,
    email: args.email,
    siteUrl,
  });
}
