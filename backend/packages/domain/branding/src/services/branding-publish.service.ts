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
  upsertTenantThemeDraft,
} from "../repositories/theme.repository";
import { defaultPresetTokens, mapBranding } from "./branding-read.service";

export async function publishTenantBrandingAndTheme(
  tx: TenantTx,
  ctx: {
    tenantId: string;
    actorMembershipId: string;
    requestId: string;
  },
) {
  const brandingBefore = await getTenantBranding(tx);
  if (!brandingBefore) throw new Error("BRANDING_NOT_FOUND");

  // A tenant that never saved a theme has no row: reads show the default
  // preset, so publishing that preset is what the admin saw.
  const themeBefore =
    (await getTenantTheme(tx)) ??
    (await upsertTenantThemeDraft(tx, { tokens: defaultPresetTokens() }));

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
