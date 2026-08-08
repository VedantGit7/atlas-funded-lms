import { existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { withPlatformScope, withTenantTx } from "@atlas/db";
import { provisionTenant } from "@atlas/domain-tenancy/services/platform-tenant-provisioning.service";
import { grantPlatformTenantEntitlements } from "@atlas/domain-tenancy/services/platform-tenant-entitlement.service";
import {
  createTenantDomain,
  deleteTenantDomain,
  publishTenantBrandingAndTheme,
  readTenantBranding,
  readTenantBrandingVersions,
  readTenantDomains,
  readTenantTheme,
  updateTenantBrandingDraft,
  updateTenantThemeDraft,
} from "@atlas/domain-branding";
import { mapTenantThemeToSemanticPayload } from "@atlas/domain-branding/utils/theme-semantic-tokens";

const describeWithE2E =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

const tenantBaseDomain = process.env["TENANT_BASE_DOMAIN"] ?? "localhost.test";
const blockedTenantSlug = ["funded", "beyond"].join("");

const adminBrandingPagePath = resolve(
  import.meta.dirname,
  "../../frontend/apps/web/src/app/admin/branding/page.tsx",
);
const adminDomainsPagePath = resolve(
  import.meta.dirname,
  "../../frontend/apps/web/src/app/admin/domains/page.tsx",
);
const adminComponentPaths = [
  "../../frontend/apps/web/src/app/admin/branding/_components/BrandingEditor.tsx",
  "../../frontend/apps/web/src/app/admin/branding/_components/BrandPreview.tsx",
  "../../frontend/apps/web/src/app/admin/branding/_components/BrandingVersionHistory.tsx",
  "../../frontend/apps/web/src/app/admin/domains/_components/DomainStatusPanel.tsx",
  "../../frontend/apps/web/src/app/admin/domains/_components/AddDomainDialog.tsx",
  "../../frontend/apps/web/src/lib/server-api.ts",
  "../../frontend/apps/web/src/lib/client-api.ts",
  "../../frontend/apps/web/src/app/admin/branding/_components/ThemeTokenEditor.tsx",
];

const draftThemeTokens = {
  primary: "#224466",
  accent: "#8899aa",
  header: "#112233",
  background: "#ffffff",
  foreground: "#101010",
  radius: "md" as const,
  modeDefault: "system" as const,
};

async function seedActiveAdminMembership(tenantId: string) {
  const principalId = randomUUID();
  const membershipId = randomUUID();
  const runId = randomUUID().slice(0, 8);

  await withPlatformScope(
    {
      principalId: randomUUID(),
      requestId: randomUUID(),
      requiredPermission: "platform.tenant.manage",
      platformPermissions: ["platform.tenant.manage"],
      tenantId,
      touchedTenantIds: [tenantId],
    },
    "Seeding active admin membership for branding and domains e2e",
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
          ${`admin-${runId}@example.test`},
          ${`admin-${runId}@example.test`},
          'active',
          now(),
          now()
        )
      `;

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

  return { membershipId };
}

async function seedBrandingThemeFoundation(tenantId: string, displayName: string) {
  await withPlatformScope(
    {
      principalId: randomUUID(),
      requestId: randomUUID(),
      requiredPermission: "platform.tenant.manage",
      platformPermissions: ["platform.tenant.manage"],
      tenantId,
      touchedTenantIds: [tenantId],
    },
    "Seeding tenant branding and theme foundation for admin e2e",
    async (tx) => {
      await tx.$executeRaw`
        INSERT INTO tenant_branding (
          id,
          tenant_id,
          display_name,
          status,
          version,
          created_at,
          updated_at
        )
        VALUES (
          gen_random_uuid(),
          ${tenantId}::uuid,
          ${displayName},
          'DRAFT',
          0,
          now(),
          now()
        )
        ON CONFLICT (tenant_id) DO NOTHING
      `;

      await tx.$executeRaw`
        INSERT INTO tenant_theme (
          id,
          tenant_id,
          primary_color,
          token_json,
          tokens_json,
          status,
          version,
          created_at,
          updated_at
        )
        VALUES (
          gen_random_uuid(),
          ${tenantId}::uuid,
          ${draftThemeTokens.primary},
          ${JSON.stringify(draftThemeTokens)}::jsonb,
          ${JSON.stringify(draftThemeTokens)}::jsonb,
          'DRAFT',
          0,
          now(),
          now()
        )
        ON CONFLICT (tenant_id) DO NOTHING
      `;
    },
  );
}

describeWithE2E("admin branding and domains smoke", () => {
  it("runs the admin branding and domain management workflow end to end", async () => {
    const runId = randomUUID().slice(0, 8);
    const slug = `brand-dom-${runId}`;
    const hostname = `${slug}.${tenantBaseDomain}`;
    const customDomainHostname = `learn-${runId}.example.com`;
    const platformPrincipalId = randomUUID();
    const requestId = randomUUID();
    const idempotencyKey = `brand-dom-e2e-${runId}`;
    const reason = "Provisioning tenant for admin branding and domains e2e smoke";
    const displayName = `Branding Domains ${runId}`;
    const ownerEmail = `${slug}-owner@example.test`;

    expect(slug.toLowerCase()).not.toContain(blockedTenantSlug);
    expect(existsSync(adminBrandingPagePath)).toBe(true);
    expect(existsSync(adminDomainsPagePath)).toBe(true);
    for (const relativePath of adminComponentPaths) {
      expect(existsSync(resolve(import.meta.dirname, relativePath))).toBe(true);
    }

    const provisioned = await withPlatformScope(
      {
        principalId: platformPrincipalId,
        requestId,
        requiredPermission: "platform.tenant.manage",
        platformPermissions: ["platform.tenant.manage"],
      },
      reason,
      async (tx) =>
        provisionTenant(
          tx,
          {
            platformPrincipalId,
            requestId,
            reason,
            idempotencyKey,
            tenantBaseDomain,
          },
          {
            slug,
            displayName,
            owner: {
              email: ownerEmail,
              displayName: "Branding Admin",
            },
            initialEntitlements: [],
          },
        ),
    );

    const tenantId = provisioned.data.id;

    await withPlatformScope(
      {
        principalId: platformPrincipalId,
        requestId: randomUUID(),
        requiredPermission: "platform.entitlement.manage",
        platformPermissions: ["platform.entitlement.manage"],
        tenantId,
        touchedTenantIds: [tenantId],
      },
      "Granting custom domain entitlement for admin domains e2e",
      async (tx) =>
        grantPlatformTenantEntitlements(tx, {
          tenantId,
          platformPrincipalId,
          requestId: randomUUID(),
          reason,
          entitlements: [
            {
              key: "branding.custom_domain.enable",
              enabled: true,
              value: true,
              expiresAt: null,
            },
          ],
        }),
    );

    const { membershipId } = await seedActiveAdminMembership(tenantId);
    await seedBrandingThemeFoundation(tenantId, displayName);

    const tenantCtx = {
      tenantId,
      actorMembershipId: membershipId,
      requestId: randomUUID(),
    };

    const openedBranding = await withTenantTx(tenantCtx, async (tx) => readTenantBranding(tx));
    expect(openedBranding.data.tenantId).toBe(tenantId);
    expect(openedBranding.data.status).toBe("DRAFT");

    const updatedBranding = await withTenantTx(tenantCtx, async (tx) =>
      updateTenantBrandingDraft(tx, {
        publicName: `${displayName} Public`,
        issuerName: `${displayName} Issuer`,
        publicLandingCopy: {
          headline: "Welcome to the academy",
        },
      }),
    );

    expect(updatedBranding.data.publicName).toBe(`${displayName} Public`);
    expect(updatedBranding.data.status).toBe("DRAFT");

    const updatedTheme = await withTenantTx(tenantCtx, async (tx) =>
      updateTenantThemeDraft(tx, {
        tokens: draftThemeTokens,
      }),
    );

    expect(updatedTheme.data.tokens.primary).toBe(draftThemeTokens.primary);
    expect(updatedTheme.data.status).toBe("DRAFT");

    const previewBranding = await withTenantTx(tenantCtx, async (tx) => readTenantBranding(tx));
    const previewTheme = await withTenantTx(tenantCtx, async (tx) => readTenantTheme(tx));
    const previewPayload = mapTenantThemeToSemanticPayload(previewTheme.data.tokens);

    expect(previewBranding.data.publicName).toBe(`${displayName} Public`);
    expect(previewBranding.data.status).toBe("DRAFT");
    expect(previewPayload.color.primary).toBe(draftThemeTokens.primary);

    const published = await withTenantTx(tenantCtx, async (tx) =>
      publishTenantBrandingAndTheme(tx, tenantCtx),
    );

    expect(published.data.status).toBe("PUBLISHED");
    expect(published.data.version).toBeGreaterThanOrEqual(1);

    const versions = await withTenantTx(tenantCtx, async (tx) => readTenantBrandingVersions(tx));

    expect(versions.data.length).toBeGreaterThanOrEqual(1);
    expect(versions.data[0]?.version).toBeGreaterThanOrEqual(1);
    expect(versions.data.some((version) => version.id.length > 0)).toBe(true);

    const openedDomains = await withTenantTx(tenantCtx, async (tx) => readTenantDomains(tx));

    expect(openedDomains.data.some((domain) => domain.hostname === hostname)).toBe(true);

    const createdDomain = await withTenantTx(tenantCtx, async (tx) =>
      createTenantDomain(tx, tenantCtx, {
        hostname: customDomainHostname,
        type: "CUSTOM_DOMAIN",
        makePrimary: false,
      }),
    );

    expect(createdDomain.data.hostname).toBe(customDomainHostname);
    expect(createdDomain.data.status).toBe("PENDING");
    expect(createdDomain.data.verificationTxtName).toBe(`_atlas-verify.${customDomainHostname}`);
    expect(createdDomain.data.verificationTxtValue).toMatch(/^atlas=[0-9a-f]{48}$/);

    const domainsAfterCreate = await withTenantTx(tenantCtx, async (tx) => readTenantDomains(tx));

    expect(domainsAfterCreate.data.some((domain) => domain.hostname === customDomainHostname)).toBe(
      true,
    );

    const deleted = await withTenantTx(tenantCtx, async (tx) =>
      deleteTenantDomain(tx, tenantCtx, createdDomain.data.id),
    );

    expect(deleted.data.status).toBe("DISABLED");

    const domainsAfterDelete = await withTenantTx(tenantCtx, async (tx) => readTenantDomains(tx));

    expect(domainsAfterDelete.data.some((domain) => domain.hostname === customDomainHostname)).toBe(
      false,
    );
  });
});
