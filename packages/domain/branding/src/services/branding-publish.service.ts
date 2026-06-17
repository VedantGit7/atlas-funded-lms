import type { TenantTx } from "@atlas/db";
import { auditWriter } from "@atlas/audit";
import { outbox } from "@atlas/events";
import {
  getTenantBranding,
  insertTenantBrandingVersion,
  markBrandingPublished,
} from "../repositories/branding.repository";
import {
  getTenantTheme,
  insertTenantThemeVersion,
  markThemePublished,
} from "../repositories/theme.repository";
import { mapBranding } from "./branding-read.service";

export async function publishTenantBrandingAndTheme(
  tx: TenantTx,
  ctx: {
    tenantId: string;
    actorMembershipId: string;
    requestId: string;
  },
) {
  const brandingBefore = await getTenantBranding(tx);
  const themeBefore = await getTenantTheme(tx);

  if (!brandingBefore) throw new Error("BRANDING_NOT_FOUND");
  if (!themeBefore) throw new Error("THEME_NOT_FOUND");

  const brandingVersion = await insertTenantBrandingVersion(tx, {
    snapshot: brandingBefore,
    publishedByMembershipId: ctx.actorMembershipId,
  });

  const themeVersion = await insertTenantThemeVersion(tx, {
    snapshot: themeBefore,
    publishedByMembershipId: ctx.actorMembershipId,
  });

  const brandingAfter = await markBrandingPublished(tx, brandingVersion.version);
  await markThemePublished(tx, themeVersion.version);

  await auditWriter.write(
    tx,
    {
      tenantId: ctx.tenantId,
      actorMembershipId: ctx.actorMembershipId,
      platformPrincipalId: null,
      requestId: ctx.requestId,
    },
    {
      action: "config.branding.published",
      target: { type: "tenant_branding", id: ctx.tenantId },
      before: {
        brandingVersion: brandingBefore.version,
        themeVersion: themeBefore.version,
      },
      after: {
        brandingVersion: brandingVersion.version,
        themeVersion: themeVersion.version,
      },
      reason: null,
      metadata: {},
    },
  );

  await outbox.publish(tx, {
    ctx: {
      tenantId: ctx.tenantId,
      actorMembershipId: ctx.actorMembershipId,
      requestId: ctx.requestId,
    },
    eventType: "config.branding.published",
    aggregateType: "tenant_branding",
    aggregateId: ctx.tenantId,
    payload: {
      tenantId: ctx.tenantId,
      brandingVersion: brandingVersion.version,
      themeVersion: themeVersion.version,
    },
    idempotencyKey: `${ctx.requestId}:branding-publish`,
  });

  return { data: mapBranding(brandingAfter) };
}
