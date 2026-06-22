import { randomUUID } from "node:crypto";
import { bootstrapOwnerRoleForTenantSeed } from "@atlas/access";
import { withPlatformScope, withTenantTx } from "@atlas/db";
import { provisionTenant } from "@atlas/domain-tenancy/services/platform-tenant-provisioning.service";
import { grantPlatformTenantEntitlements } from "@atlas/domain-tenancy/services/platform-tenant-entitlement.service";
import {
  updateTenantBrandingDraft,
  updateTenantThemeDraft,
} from "@atlas/domain-branding/services/branding-update.service";
import { createTenantDomain } from "@atlas/domain-branding/services/domain-admin.service";
import { updateTenantConfigDraft } from "@atlas/domain-config/services/tenant-config.service";
import { updateTenantFeatureFlagOverride } from "@atlas/domain-config/services/feature-flag.service";
import type { ApplyEnvironment, TenantManifest } from "@atlas/tenant-config";
import { buildApplyPlan, formatApplyPlan } from "@atlas/tenant-config";
import {
  createCompetencyDimension,
  createScoringProfile,
} from "../../apps/web/src/server/competency/competency-config.service";
import { replaceProfileBands } from "../../apps/web/src/server/competency/scoring-config.service";
import { createLearningPathDraft } from "../../apps/web/src/server/learning-paths/learning-path.service";
import { createCertificateTemplate } from "../../apps/web/src/server/certificates/certificate.service";
import { createSpace } from "../../apps/web/src/server/community/community.service";
import { createBadgeFromPost } from "../../apps/web/src/server/gamification/gamification.service";
import { updateReadinessPolicy } from "../../apps/web/src/server/readiness/readiness-policy.service";
import { createExtensionRegistration } from "../../apps/web/src/server/extensions/extensions.service";

export type ApplyContext = {
  environment: ApplyEnvironment;
  platformPrincipalId: string;
  requestId: string;
  reason: string;
  tenantBaseDomain: string;
  ownerEmail: string;
  ownerDisplayName: string;
  productionPlanOnly?: boolean;
};

export type ApplyResult = {
  tenantId: string;
  actorMembershipId: string;
  plan: string;
};

async function findTenantIdBySlug(slug: string): Promise<string | null> {
  return withPlatformScope(
    {
      principalId: randomUUID(),
      requestId: randomUUID(),
      requiredPermission: "platform.tenant.read",
      platformPermissions: ["platform.tenant.read"],
    },
    "Resolve tenant id by slug for tenant config apply",
    async (tx) => {
      const rows = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id::text
        FROM tenants
        WHERE slug = ${slug}
          AND deleted_at IS NULL
        LIMIT 1
      `;
      return rows[0]?.id ?? null;
    },
  );
}

async function ensureProvisionedTenant(
  manifest: TenantManifest,
  ctx: ApplyContext,
): Promise<string> {
  const existingId = await findTenantIdBySlug(manifest.tenant.slug);
  if (existingId) {
    return existingId;
  }

  const provisioned = await withPlatformScope(
    {
      principalId: ctx.platformPrincipalId,
      requestId: ctx.requestId,
      requiredPermission: "platform.tenant.manage",
      platformPermissions: ["platform.tenant.manage"],
    },
    ctx.reason,
    async (tx) =>
      provisionTenant(
        tx,
        {
          platformPrincipalId: ctx.platformPrincipalId,
          requestId: ctx.requestId,
          reason: ctx.reason,
          idempotencyKey: `tenant-config-${manifest.tenant.slug}-${ctx.environment}`,
          tenantBaseDomain: ctx.tenantBaseDomain,
        },
        {
          slug: manifest.tenant.slug,
          displayName: manifest.tenant.displayName,
          legalName: manifest.tenant.legalName ?? null,
          defaultLocale: manifest.tenant.defaultLocale,
          defaultTimezone: manifest.tenant.defaultTimezone,
          owner: {
            email: ctx.ownerEmail,
            displayName: ctx.ownerDisplayName,
          },
          initialEntitlements: [],
          seedProfile: "EMPTY",
        },
      ),
  );

  return provisioned.data.id;
}

async function ensureActiveActorMembership(
  tenantId: string,
  manifest: TenantManifest,
  ctx: ApplyContext,
): Promise<string> {
  if (ctx.environment !== "test" && ctx.environment !== "development") {
    const membershipId = process.env["TENANT_CONFIG_ACTOR_MEMBERSHIP_ID"];
    if (!membershipId) {
      throw new Error(
        "TENANT_CONFIG_ACTOR_MEMBERSHIP_ID is required for non-test tenant configuration apply.",
      );
    }
    return membershipId;
  }

  const email =
    manifest.testOwner?.email ?? ctx.ownerEmail ?? `${manifest.tenant.slug}-owner@example.test`;
  const principalId = randomUUID();
  const membershipId = randomUUID();

  await withPlatformScope(
    {
      principalId: ctx.platformPrincipalId,
      requestId: ctx.requestId,
      requiredPermission: "platform.tenant.manage",
      platformPermissions: ["platform.tenant.manage"],
      tenantId,
      touchedTenantIds: [tenantId],
    },
    "Ensure synthetic tenant actor membership for tenant config apply",
    async (tx) => {
      await tx.$executeRaw`
        INSERT INTO auth_principals (
          id,
          supabase_user_id,
          email,
          email_normalized,
          global_status,
          created_at,
          updated_at
        )
        VALUES (
          ${principalId}::uuid,
          ${randomUUID()}::uuid,
          ${email},
          ${email.toLowerCase()},
          'active',
          now(),
          now()
        )
        ON CONFLICT DO NOTHING
      `;

      const existing = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id::text
        FROM memberships
        WHERE tenant_id = ${tenantId}::uuid
          AND status = 'ACTIVE'
        ORDER BY created_at ASC
        LIMIT 1
      `;

      if (existing[0]) {
        return;
      }

      await tx.$executeRaw`
        INSERT INTO memberships (
          id,
          tenant_id,
          auth_principal_id,
          status,
          joined_at,
          created_at,
          updated_at
        )
        VALUES (
          ${membershipId}::uuid,
          ${tenantId}::uuid,
          ${principalId}::uuid,
          'ACTIVE',
          now(),
          now(),
          now()
        )
      `;
    },
  );

  const resolvedMembershipId = await withPlatformScope(
    {
      principalId: ctx.platformPrincipalId,
      requestId: randomUUID(),
      requiredPermission: "platform.tenant.read",
      platformPermissions: ["platform.tenant.read"],
      tenantId,
      touchedTenantIds: [tenantId],
    },
    "Resolve active membership for tenant config apply",
    async (tx) => {
      const rows = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id::text
        FROM memberships
        WHERE tenant_id = ${tenantId}::uuid
          AND status = 'ACTIVE'
        ORDER BY created_at ASC
        LIMIT 1
      `;
      return rows[0]?.id ?? membershipId;
    },
  );

  await withTenantTx(
    {
      tenantId,
      actorMembershipId: resolvedMembershipId,
      requestId: ctx.requestId,
    },
    async (tx) => {
      await bootstrapOwnerRoleForTenantSeed({
        tx,
        tenantId,
        ownerMembershipId: resolvedMembershipId,
      });
    },
  );

  return resolvedMembershipId;
}

function tenantServiceCtx(tenantId: string, actorMembershipId: string, requestId: string) {
  return { tenantId, actorMembershipId, requestId };
}

async function applyTenantScopedConfiguration(
  manifest: TenantManifest,
  tenantId: string,
  actorMembershipId: string,
  ctx: ApplyContext,
): Promise<void> {
  const serviceCtx = tenantServiceCtx(tenantId, actorMembershipId, ctx.requestId);
  const domainRecord = manifest.domains[ctx.environment];

  await withTenantTx(serviceCtx, async (tx) => {
    await updateTenantBrandingDraft(tx, {
      publicName: manifest.branding.publicName,
      issuerName: manifest.branding.issuerName ?? null,
      publicLandingCopy: manifest.branding.publicLandingCopy ?? null,
      ...(manifest.branding.logoLightStorageRefId !== undefined
        ? {
            logoLight: {
              storageRefId: manifest.branding.logoLightStorageRefId,
              altText: manifest.branding.publicName,
            },
          }
        : {}),
      ...(manifest.branding.logoDarkStorageRefId !== undefined
        ? {
            logoDark: {
              storageRefId: manifest.branding.logoDarkStorageRefId,
              altText: manifest.branding.publicName,
            },
          }
        : {}),
      ...(manifest.branding.faviconStorageRefId !== undefined
        ? {
            favicon: {
              storageRefId: manifest.branding.faviconStorageRefId,
              altText: null,
            },
          }
        : {}),
    });

    await updateTenantThemeDraft(tx, {
      tokens: manifest.theme.tokens,
    });

    if (domainRecord) {
      const existing = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id::text
        FROM tenant_domains
        WHERE tenant_id = ${tenantId}::uuid
          AND lower(hostname) = ${domainRecord.hostname.toLowerCase()}
          AND deleted_at IS NULL
        LIMIT 1
      `;

      if (existing.length === 0) {
        await createTenantDomain(tx, serviceCtx, {
          hostname: domainRecord.hostname,
          type: domainRecord.type,
          makePrimary: domainRecord.makePrimary,
        });
      }
    }

    await updateTenantConfigDraft(tx, {
      configJson: {
        ...manifest.tenantConfigJson,
        launchLocale: manifest.locale.code,
        tenantConfigManifestVersion: manifest.manifestVersion,
      },
    });

    for (const override of manifest.featureFlagOverrides) {
      await updateTenantFeatureFlagOverride(tx, serviceCtx, override.key, {
        value: override.value,
      });
    }

    for (const extension of manifest.extensions) {
      await createExtensionRegistration(tx, serviceCtx, {
        extensionPointKey: extension.extensionPointKey,
        registrationKey: extension.registrationKey,
        configJson: extension.configJson,
        status: extension.status,
      });
    }

    for (const dimension of manifest.scoring.dimensions) {
      const existing = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id::text FROM competency_dimensions
        WHERE tenant_id = ${tenantId}::uuid AND key = ${dimension.key}
        LIMIT 1
      `;
      if (existing.length === 0) {
        await createCompetencyDimension(tx, serviceCtx, dimension);
      }
    }

    const profileRows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id::text FROM scoring_profiles
      WHERE tenant_id = ${tenantId}::uuid AND key = ${manifest.scoring.profileKey}
      LIMIT 1
    `;

    let profileId = profileRows[0]?.id;
    if (!profileId) {
      const created = await createScoringProfile(tx, serviceCtx, {
        key: manifest.scoring.profileKey,
        name: manifest.scoring.profileName,
      });
      profileId = created.data.id;
    }

    const bandCount = await tx.$queryRaw<Array<{ count: bigint }>>`
      SELECT count(*)::bigint AS count
      FROM competency_bands
      WHERE tenant_id = ${tenantId}::uuid
        AND scoring_profile_id = ${profileId}::uuid
    `;

    if (Number(bandCount[0]?.count ?? 0n) === 0) {
      await replaceProfileBands(tx, serviceCtx, profileId, {
        bands: manifest.scoring.bands,
      });
    }

    if (manifest.readiness.legalApproval.status === "approved") {
      const ctaCopy = manifest.readiness.ctaPolicy.ctaCopy;
      const legalCopy = manifest.readiness.legalCopy;
      if (!ctaCopy || !legalCopy) {
        throw new Error("Approved readiness manifest is missing CTA or legal copy.");
      }

      await updateReadinessPolicy(tx, serviceCtx, {
        scoringProfileId: profileId,
        ctaPolicy: {
          ...manifest.readiness.ctaPolicy,
          ctaCopy,
        },
        legalCopy,
        status: "INACTIVE",
      });
    }

    for (const path of manifest.learningPaths) {
      if (path.availability === "unavailable") {
        continue;
      }

      const existing = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id::text FROM learning_paths
        WHERE tenant_id = ${tenantId}::uuid AND slug = ${path.slug}
        LIMIT 1
      `;
      if (existing.length === 0) {
        await createLearningPathDraft(tx, serviceCtx, {
          slug: path.slug,
          title: path.title,
          description: path.description ?? null,
          pathType: path.pathType,
          metadata: path.metadata,
        });
      }
    }

    for (const template of manifest.certificateTemplates) {
      const existing = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id::text FROM certificate_templates
        WHERE tenant_id = ${tenantId}::uuid AND key = ${template.key}
        LIMIT 1
      `;
      if (existing.length === 0) {
        await createCertificateTemplate(tx, serviceCtx, template);
      }
    }

    for (const badge of manifest.gamification.badges) {
      const existing = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id::text FROM badges
        WHERE tenant_id = ${tenantId}::uuid AND key = ${badge.key}
        LIMIT 1
      `;
      if (existing.length === 0) {
        await createBadgeFromPost(tx, serviceCtx, badge);
      }
    }

    for (const space of manifest.communitySpaces) {
      const existing = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id::text FROM community_spaces
        WHERE tenant_id = ${tenantId}::uuid AND slug = ${space.slug}
        LIMIT 1
      `;
      if (existing.length === 0) {
        await createSpace(tx, serviceCtx, space);
      }
    }
  });
}

export async function applyTenantManifest(
  manifest: TenantManifest,
  ctx: ApplyContext,
): Promise<ApplyResult> {
  const plan = buildApplyPlan(manifest, ctx.environment, {
    productionPlanOnly: ctx.productionPlanOnly,
  });

  if (ctx.productionPlanOnly || ctx.environment === "production") {
    return {
      tenantId: "",
      actorMembershipId: "",
      plan: formatApplyPlan(plan),
    };
  }

  const tenantId = await ensureProvisionedTenant(manifest, ctx);

  if (manifest.entitlements.length > 0) {
    await withPlatformScope(
      {
        principalId: ctx.platformPrincipalId,
        requestId: ctx.requestId,
        requiredPermission: "platform.entitlement.manage",
        platformPermissions: ["platform.entitlement.manage"],
        tenantId,
        touchedTenantIds: [tenantId],
      },
      "Grant tenant manifest entitlements",
      async (tx) =>
        grantPlatformTenantEntitlements(tx, {
          tenantId,
          platformPrincipalId: ctx.platformPrincipalId,
          requestId: ctx.requestId,
          reason: ctx.reason,
          entitlements: manifest.entitlements.map((entitlement) => ({
            key: entitlement.key,
            enabled: entitlement.enabled,
            value: entitlement.value ?? null,
            expiresAt: entitlement.expiresAt ?? null,
          })),
        }),
    );
  }

  const actorMembershipId = await ensureActiveActorMembership(tenantId, manifest, ctx);
  await applyTenantScopedConfiguration(manifest, tenantId, actorMembershipId, ctx);

  return {
    tenantId,
    actorMembershipId,
    plan: formatApplyPlan(plan),
  };
}
