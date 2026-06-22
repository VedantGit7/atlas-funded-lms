import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildVerifyReport, loadTenantManifest } from "@atlas/tenant-config";
import { applyTenantManifest } from "../../scripts/tenants/apply-adapter";

const describeWithE2E =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

describeWithE2E("tenant config e2e", () => {
  it("applies second smoke tenant fixture without fundedbeyond leakage", async () => {
    const runId = randomUUID().slice(0, 8);
    const manifest = loadTenantManifest("second-smoke-academy");
    const slug = `${manifest.tenant.slug}-${runId}`;
    const adapted = {
      ...manifest,
      tenant: { ...manifest.tenant, slug },
      testOwner: {
        email: `${slug}-owner@example.test`,
        displayName: "Second Smoke Owner",
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

    const applied = await applyTenantManifest(adapted, {
      environment: "test",
      platformPrincipalId: randomUUID(),
      requestId: randomUUID(),
      reason: "E2E second smoke tenant config apply",
      tenantBaseDomain: process.env["TENANT_BASE_DOMAIN"] ?? "localhost.test",
      ownerEmail: adapted.testOwner.email,
      ownerDisplayName: adapted.testOwner.displayName,
    });

    const report = buildVerifyReport(adapted, "test");
    expect(report.passed).toBe(true);
    expect(applied.tenantId).toBeTruthy();
    expect(JSON.stringify(adapted).toLowerCase()).not.toContain("fundedbeyond");
  });
});
