import type { TenantTx } from "@atlas/db";
import { recordAuditChange } from "../server/audit-change";
import { publishSecurityEvent } from "../server/notifications/security-notification.service";
import type { SecurityNotificationEventKey } from "../server/notifications/security-notification.events";

type ServiceCtx = {
  tenantId: string;
  actorMembershipId: string;
  requestId: string;
};

export async function resolveTenantPublicSiteUrl(tx: TenantTx, tenantId: string): Promise<string> {
  const rows = await tx.$queryRaw<Array<{ hostname: string }>>`
    select hostname
    from tenant_domains
    where tenant_id = ${tenantId}::uuid
      and is_primary = true
      and deleted_at is null
    limit 1
  `;

  const hostname = rows[0]?.hostname;
  if (hostname) {
    return `https://${hostname}`;
  }

  // This URL becomes the "Secure my account" link in a security email. Falling
  // back to a hardcoded brand meant a tenant with no primary domain sent its
  // learners to a DIFFERENT company's site to secure their account — indistinguishable
  // from a phishing link. PUBLIC_SITE_URL is the platform's configured default;
  // if that is unset there is no safe URL to emit, so fail rather than guess.
  const configuredDefault = process.env["PUBLIC_SITE_URL"]?.trim();
  if (!configuredDefault) {
    throw new Error(
      `No primary domain for tenant ${tenantId} and PUBLIC_SITE_URL is unset. ` +
        "Refusing to build a security email link against an unknown origin.",
    );
  }

  return configuredDefault;
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

  // Audit M7: a change to how the member signs in is on the record, under the
  // same name as the notification the member receives about it.
  await recordAuditChange(tx, ctx, {
    action: args.eventType,
    target: { type: "membership", id: ctx.actorMembershipId },
    before: null,
    after: null,
  });

  await publishSecurityEvent(tx, ctx, {
    eventType: args.eventType,
    membershipId: ctx.actorMembershipId,
    email: args.email,
    siteUrl,
  });
}
