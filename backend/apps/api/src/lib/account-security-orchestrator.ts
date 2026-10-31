import { globalDbPerStatement } from "@atlas/api";
import type { TenantTx } from "@atlas/db";
import { withGlobalDb } from "@atlas/db/global-db";
import { withTenantTx } from "@atlas/db/with-tenant-tx";
import { findMembershipByPrincipal } from "@atlas/membership";
import { structuredLogger } from "@atlas/observability/logger";
import { lookupTenantFromHost } from "@atlas/tenancy";
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

/**
 * After "forgot password" changes a password: the same security email as an
 * in-app change, to the person's membership in the academy whose site the
 * reset ran on. A reset on a host with no academy (the platform console), or
 * by someone with no active membership there, has nobody to tell. The password
 * has already changed, so a failure here is logged, never thrown.
 */
export async function notifyPasswordReset(args: {
  host: string;
  requestId: string;
  supabaseUserId: string;
  email: string;
}): Promise<void> {
  try {
    const tenant = await withGlobalDb((db) =>
      lookupTenantFromHost({ host: args.host, requestId: args.requestId, db }),
    );
    if (!tenant || tenant.tenantState !== "ACTIVE") return;

    // A global table: read on its own connection, never inside the tenant transaction.
    const principals = await globalDbPerStatement.$queryRaw<{ id: string }[]>`
      select id::text
      from auth_principals
      where supabase_user_id = ${args.supabaseUserId}::uuid
      limit 1
    `;
    const principalId = principals[0]?.id;
    if (!principalId) return;

    await withTenantTx(
      { tenantId: tenant.tenantId, requestId: args.requestId, allowAnonymousTenantRead: true },
      async (tx) => {
        const membership = await findMembershipByPrincipal({
          tx,
          tenantId: tenant.tenantId,
          authPrincipalId: principalId,
        });
        if (membership?.status !== "ACTIVE") return;

        await emitSecurityNotification(
          tx,
          {
            tenantId: tenant.tenantId,
            actorMembershipId: membership.id,
            requestId: args.requestId,
          },
          { eventType: "security.password_changed", email: args.email },
        );
      },
    );
  } catch (error) {
    structuredLogger.warn({
      message: "Could not send the password-changed email after a password reset",
      module: "auth",
      eventType: "auth.password_reset_notice_failed",
      requestId: args.requestId,
      detail: error instanceof Error ? error.message.slice(0, 300) : String(error).slice(0, 300),
    });
  }
}
