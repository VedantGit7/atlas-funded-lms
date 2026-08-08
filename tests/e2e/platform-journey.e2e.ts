import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const webRoot = resolve(import.meta.dirname, "../../frontend/apps/web/src");

const platformJourneyPaths = [
  "app/platform/page.tsx",
  "app/platform/tenants/new/page.tsx",
  "app/platform/tenants/[id]/page.tsx",
  "app/platform/feature-flags/page.tsx",
  "app/platform/catalog/page.tsx",
  "app/platform/audit/page.tsx",
  "app/platform/support/page.tsx",
  "app/platform/eventing/page.tsx",
  "features/platform/components/PlatformTenantListClient.tsx",
  "features/platform/components/ProvisionTenantWizard.tsx",
  "features/platform/components/PlatformTenantDetailClient.tsx",
  "features/platform/components/GlobalFeatureFlagEditor.tsx",
  "features/platform/components/GlobalCatalogTabs.tsx",
  "features/platform/components/PlatformAuditTable.tsx",
  "features/platform/components/SupportSessionPanel.tsx",
  "features/platform/components/DeadLetterEventTable.tsx",
  "features/platform/components/PlatformReasonProvider.tsx",
  "features/platform/components/PlatformPageGate.tsx",
  "lib/server/platform-page-access.ts",
];

describe("platform journey e2e wiring", () => {
  it("includes tenant list → provision → detail → flags → catalog → audit → support → eventing path files", () => {
    for (const relativePath of platformJourneyPaths) {
      expect(existsSync(resolve(webRoot, relativePath))).toBe(true);
    }
  });

  it("tenant list links into provision when operator can manage tenants", () => {
    const list = readFileSync(
      resolve(webRoot, "features/platform/components/PlatformTenantListClient.tsx"),
      "utf8",
    );
    expect(list).toContain('href="/platform/tenants/new"');
    expect(list).toContain("canProvision");
  });

  it("tenant detail links lifecycle and entitlement flows through reason-gated dialogs", () => {
    const detail = readFileSync(
      resolve(webRoot, "features/platform/components/PlatformTenantDetailClient.tsx"),
      "utf8",
    );
    expect(detail).toContain("PlatformReasonDialog");
    expect(detail).not.toContain("window.confirm");
    expect(detail).toContain("PlatformEntitlementEditor");
  });

  it("global mutations require operational reason across flags and catalog", () => {
    const flags = readFileSync(
      resolve(webRoot, "features/platform/components/GlobalFeatureFlagEditor.tsx"),
      "utf8",
    );
    const catalog = readFileSync(
      resolve(webRoot, "features/platform/components/GlobalCatalogTabs.tsx"),
      "utf8",
    );
    expect(flags).toContain("PlatformReasonDialog");
    expect(catalog).toContain("PlatformReasonDialog");
  });
});
