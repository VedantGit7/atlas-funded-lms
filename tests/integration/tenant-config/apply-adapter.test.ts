import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { withPlatformScope } from "@atlas/db";
import { loadTenantManifest } from "@atlas/tenant-config";
import { applyTenantManifest } from "../../../scripts/tenants/apply-adapter";

const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

describeWithDb("tenant config apply adapter", () => {
  it("applies fundedbeyond manifest idempotently in test environment", async () => {
    const runId = randomUUID().slice(0, 8);
    const manifest = loadTenantManifest("fundedbeyond");
    const slug = `${manifest.tenant.slug}-cfg-${runId}`;
    const adapted = {
      ...manifest,
      tenant: { ...manifest.tenant, slug },
      testOwner: {
        email: `${slug}-owner@example.test`,
        displayName: "Config Apply Owner",
      },
      domains: {
        ...manifest.domains,
        test: {
          hostname: `${slug}.localhost.test`,
          type: "ATLAS_SUBDOMAIN" as const,
          makePrimary: false,
          recordOnly: true,
        },
      },
    };

    const testOwner = adapted.testOwner;
    if (!testOwner) {
      throw new Error("Missing test owner fixture.");
    }

    const ctx = {
      environment: "test" as const,
      platformPrincipalId: randomUUID(),
      requestId: randomUUID(),
      reason: "Integration test tenant config apply",
      tenantBaseDomain: process.env["TENANT_BASE_DOMAIN"] ?? "localhost.test",
      ownerEmail: testOwner.email,
      ownerDisplayName: testOwner.displayName,
    };

    const first = await applyTenantManifest(adapted, ctx);
    const second = await applyTenantManifest(adapted, ctx);

    expect(first.tenantId).toBeTruthy();
    expect(second.tenantId).toBe(first.tenantId);

    const dimensionCount = await withPlatformScope(
      {
        principalId: randomUUID(),
        requestId: randomUUID(),
        requiredPermission: "platform.tenant.read",
        platformPermissions: ["platform.tenant.read"],
        tenantId: first.tenantId,
        touchedTenantIds: [first.tenantId],
      },
      "Verify competency dimensions after tenant config apply",
      async (tx) => {
        const rows = await tx.$queryRaw<Array<{ count: bigint }>>`
          SELECT count(*)::bigint AS count
          FROM competency_dimensions
          WHERE tenant_id = ${first.tenantId}::uuid
        `;
        return Number(rows[0]?.count ?? 0n);
      },
    );

    expect(dimensionCount).toBe(adapted.scoring.dimensions.length);
  });
});
