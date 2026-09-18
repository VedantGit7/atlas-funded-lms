import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { withPlatformScope } from "@atlas/db";
import { TENANT_SYSTEM_ROLES } from "@atlas/access";
import { provisionTenant } from "@atlas/domain-tenancy/services/platform-tenant-provisioning.service";
import { readPlatformTenantEntitlements } from "@atlas/domain-tenancy/services/platform-tenant-entitlement.service";

const describeWithE2E =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

const tenantBaseDomain = process.env["TENANT_BASE_DOMAIN"] ?? "localhost.test";
const blockedTenantSlug = ["funded", "beyond"].join("");

describeWithE2E("platform provision second tenant smoke", () => {
  it("provisions an active smoke tenant with domain, roles, entitlements, owner invite, and audit trail", async () => {
    const runId = randomUUID().slice(0, 8);
    const slug = `smoke-tenant-${runId}`;
    const hostname = `${slug}.${tenantBaseDomain}`;
    const platformPrincipalId = randomUUID();
    const requestId = randomUUID();
    const idempotencyKey = `smoke-provision-${runId}`;
    const reason = "Provisioning smoke tenant for platform e2e verification";
    const ownerEmail = `${slug}-owner@example.test`;

    expect(slug.toLowerCase()).not.toContain(blockedTenantSlug);

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
            displayName: `Smoke Tenant ${runId}`,
            owner: {
              email: ownerEmail,
              displayName: "Smoke Owner",
            },
            initialEntitlements: [
              {
                key: "feature.community",
                enabled: true,
                value: null,
                expiresAt: null,
              },
            ],
          },
        ),
    );

    const tenantId = provisioned.data.id;

    expect(provisioned.data.state).toBe("ACTIVE");
    expect(provisioned.data.slug).toBe(slug);
    expect(provisioned.data.primaryDomain).toMatchObject({
      hostname,
      status: "ACTIVE",
      // Migration 033 (normalize_tenant_domain_type_values) uppercased these;
      // the assertion kept the pre-normalisation spelling.
      type: "ATLAS_SUBDOMAIN",
    });
    expect(provisioned.data.provisioning.latestStatus).toBe("SUCCEEDED");

    const resolvedTenant = await withPlatformScope(
      {
        principalId: platformPrincipalId,
        requestId: randomUUID(),
        requiredPermission: "platform.tenant.read",
        platformPermissions: ["platform.tenant.read"],
        tenantId,
        touchedTenantIds: [tenantId],
      },
      "Verifying smoke tenant fallback domain resolution",
      async (tx) => {
        const rows = await tx.$queryRaw<
          Array<{ tenant_id: string; slug: string; hostname: string; state: string }>
        >`
          SELECT
            t.id::text AS tenant_id,
            t.slug,
            t.state::text AS state,
            td.hostname
          FROM tenant_domains td
          JOIN tenants t ON t.id = td.tenant_id
          WHERE lower(td.hostname) = ${hostname.toLowerCase()}
            AND td.deleted_at IS NULL
            AND t.deleted_at IS NULL
          LIMIT 1
        `;

        return rows[0];
      },
    );

    expect(resolvedTenant).toMatchObject({
      tenant_id: tenantId,
      slug,
      state: "ACTIVE",
      hostname,
    });

    const ownerInvitation = await withPlatformScope(
      {
        principalId: platformPrincipalId,
        requestId: randomUUID(),
        requiredPermission: "platform.tenant.read",
        platformPermissions: ["platform.tenant.read"],
        tenantId,
        touchedTenantIds: [tenantId],
      },
      "Verifying smoke tenant owner invitation",
      async (tx) => {
        const rows = await tx.$queryRaw<
          Array<{ status: string; invited_email_normalized: string | null }>
        >`
          SELECT status::text, invited_email_normalized
          FROM memberships
          WHERE tenant_id = ${tenantId}::uuid
            AND status = 'INVITED'
          ORDER BY created_at ASC
          LIMIT 1
        `;

        return rows[0];
      },
    );

    expect(ownerInvitation).toMatchObject({
      status: "INVITED",
      invited_email_normalized: ownerEmail.toLowerCase(),
    });
    expect(ownerInvitation?.invited_email_normalized).not.toBeNull();

    const roleKeys = await withPlatformScope(
      {
        principalId: platformPrincipalId,
        requestId: randomUUID(),
        requiredPermission: "platform.tenant.read",
        platformPermissions: ["platform.tenant.read"],
        tenantId,
        touchedTenantIds: [tenantId],
      },
      "Verifying smoke tenant seeded roles",
      async (tx) => {
        const rows = await tx.$queryRaw<Array<{ key: string }>>`
          SELECT key
          FROM roles
          WHERE tenant_id = ${tenantId}::uuid
            AND deleted_at IS NULL
          ORDER BY key ASC
        `;

        return rows.map((row) => row.key);
      },
    );

    expect(roleKeys.sort()).toEqual(TENANT_SYSTEM_ROLES.map((role) => role.key).sort());

    const entitlements = await withPlatformScope(
      {
        principalId: platformPrincipalId,
        requestId: randomUUID(),
        requiredPermission: "platform.entitlement.manage",
        platformPermissions: ["platform.entitlement.manage"],
        tenantId,
        touchedTenantIds: [tenantId],
      },
      "Verifying smoke tenant initial entitlements",
      async (tx) => readPlatformTenantEntitlements(tx, tenantId),
    );

    expect(entitlements.data).toEqual([
      expect.objectContaining({
        key: "feature.community",
        enabled: true,
      }),
    ]);

    const auditActions = await withPlatformScope(
      {
        principalId: platformPrincipalId,
        requestId: randomUUID(),
        requiredPermission: "platform.audit.read",
        platformPermissions: ["platform.audit.read"],
        tenantId,
        touchedTenantIds: [tenantId],
      },
      "Verifying smoke tenant provisioning audit trail",
      async (tx) => {
        const rows = await tx.$queryRaw<Array<{ action: string }>>`
          SELECT action
          FROM audit_entries
          WHERE tenant_id = ${tenantId}::uuid
          ORDER BY occurred_at ASC
        `;

        return rows.map((row) => row.action);
      },
    );

    expect(auditActions).toContain("tenant.created");
    expect(auditActions).toContain("tenant.state_changed");

    const outboxEvents = await withPlatformScope(
      {
        principalId: platformPrincipalId,
        requestId: randomUUID(),
        requiredPermission: "platform.tenant.read",
        platformPermissions: ["platform.tenant.read"],
        tenantId,
        touchedTenantIds: [tenantId],
      },
      "Verifying smoke tenant provisioning outbox events",
      async (tx) => {
        const rows = await tx.$queryRaw<Array<{ event_type: string }>>`
          SELECT event_type
          FROM outbox_events
          WHERE tenant_id = ${tenantId}::uuid
          ORDER BY occurred_at ASC
        `;

        return rows.map((row) => row.event_type);
      },
    );

    expect(outboxEvents).toContain("tenant.created");
    expect(outboxEvents).toContain("tenant.state_changed");

    const serviceSource = readFileSync(
      resolve(
        import.meta.dirname,
        "../../backend/packages/domain/tenancy/src/services/platform-tenant-provisioning.service.ts",
      ),
      "utf8",
    );
    const helpersSource = readFileSync(
      resolve(
        import.meta.dirname,
        "../../backend/packages/domain/tenancy/src/services/platform-tenant-provisioning.helpers.ts",
      ),
      "utf8",
    );

    expect(serviceSource.toLowerCase()).not.toContain(blockedTenantSlug);
    expect(helpersSource.toLowerCase()).not.toContain(blockedTenantSlug);
  });
});
