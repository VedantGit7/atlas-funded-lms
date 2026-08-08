import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const webRoot = resolve(import.meta.dirname, "../../../frontend/apps/web/src");
const apiRoot = resolve(import.meta.dirname, "../../../backend/apps/api/src/app/api/v1");

describe("F7 platform console", () => {
  it("maps P1-P8 in platform route registry", () => {
    const registry = readFileSync(
      resolve(webRoot, "features/platform/platform-route-registry.ts"),
      "utf8",
    );
    expect(registry).toContain('screenId: "P1"');
    expect(registry).toContain('screenId: "P8"');
  });

  it("global feature flag editor wires PUT /platform/feature-flags/:key", () => {
    const editor = readFileSync(
      resolve(webRoot, "features/platform/components/GlobalFeatureFlagEditor.tsx"),
      "utf8",
    );
    expect(editor).toContain("platformApi.put");
    expect(editor).toContain("/api/v1/platform/feature-flags/");
    expect(editor).toContain("platform-flag-update");
    expect(editor).toContain("description");
  });

  it("platform reason gate prompts through provider", () => {
    const provider = readFileSync(
      resolve(webRoot, "features/platform/components/PlatformReasonProvider.tsx"),
      "utf8",
    );
    const gate = readFileSync(
      resolve(webRoot, "features/platform/components/PlatformReasonDialog.tsx"),
      "utf8",
    );
    expect(provider).toContain("promptForReason");
    expect(gate).toContain("promptForReason");
  });

  it("tenant list shows primary host, state filter, and pagination", () => {
    const list = readFileSync(
      resolve(webRoot, "features/platform/components/PlatformTenantListClient.tsx"),
      "utf8",
    );
    expect(list).toContain("Primary host");
    expect(list).toContain("Load more");
    expect(list).toContain("primaryDomain");
    expect(list).toContain("stateFilter");
  });

  it("provision wizard supports initial entitlements editor", () => {
    const wizard = readFileSync(
      resolve(webRoot, "features/platform/components/ProvisionTenantWizard.tsx"),
      "utf8",
    );
    const editor = readFileSync(
      resolve(webRoot, "features/platform/components/PlatformEntitlementEditor.tsx"),
      "utf8",
    );
    expect(wizard).toContain("initialEntitlements");
    expect(wizard).toContain("PlatformEntitlementEditor");
    expect(editor).toContain("entitlementDraftToApi");
  });

  it("tenant detail guards lifecycle actions and full entitlement editor", () => {
    const detail = readFileSync(
      resolve(webRoot, "features/platform/components/PlatformTenantDetailClient.tsx"),
      "utf8",
    );
    expect(detail).toContain("canSuspend");
    expect(detail).toContain("PlatformEntitlementEditor");
    expect(detail).toContain("dialogKind");
  });

  it("catalog tabs support POST create flows with schemaJson", () => {
    const catalog = readFileSync(
      resolve(webRoot, "features/platform/components/GlobalCatalogTabs.tsx"),
      "utf8",
    );
    expect(catalog).toContain("platformApi.post");
    expect(catalog).toContain("Add entry");
    expect(catalog).toContain("schemaJson");
  });

  it("platform audit supports action and targetType filters with scope highlight", () => {
    const audit = readFileSync(
      resolve(webRoot, "features/platform/components/PlatformAuditTable.tsx"),
      "utf8",
    );
    expect(audit).toContain("actionFilter");
    expect(audit).toContain("targetTypeFilter");
    expect(audit).toContain("Load more");
    expect(audit).toContain("isScopeTransition");
    expect(audit).toContain("requestId");
  });

  it("support sessions surface open errors", () => {
    const support = readFileSync(
      resolve(webRoot, "features/platform/components/SupportSessionPanel.tsx"),
      "utf8",
    );
    expect(support).toContain("setError");
    expect(support).toContain("Failed to open support session");
  });

  it("dead-letter table paginates and shows replay feedback", () => {
    const eventing = readFileSync(
      resolve(webRoot, "features/platform/components/DeadLetterEventTable.tsx"),
      "utf8",
    );
    expect(eventing).toContain("tenantId");
    expect(eventing).toContain("Load more");
    expect(eventing).toContain("setMessage");
  });

  it("platform pages gate deep links with loadPlatformPageAccess", () => {
    const pages = [
      "app/platform/page.tsx",
      "app/platform/tenants/new/page.tsx",
      "app/platform/tenants/[id]/page.tsx",
      "app/platform/feature-flags/page.tsx",
      "app/platform/catalog/page.tsx",
      "app/platform/audit/page.tsx",
      "app/platform/support/page.tsx",
      "app/platform/eventing/page.tsx",
    ];

    for (const page of pages) {
      const source = readFileSync(resolve(webRoot, page), "utf8");
      expect(source).toContain("PlatformPageGate");
      expect(source).toContain("loadPlatformPageAccess");
    }
  });

  it("exposes PUT platform feature-flags route on API app", () => {
    const route = readFileSync(
      resolve(apiRoot, "platform/feature-flags/[key]/route.ts"),
      "utf8",
    );
    expect(route).toContain("updatePlatformFeatureFlag");
    expect(route).toContain("export async function PUT");
  });

  it("validates rolloutType against defaultValue in feature flag service", () => {
    const service = readFileSync(
      resolve(
        import.meta.dirname,
        "../../../backend/packages/domain/config/src/services/platform-feature-flag.service.ts",
      ),
      "utf8",
    );
    expect(service).toContain("assertRolloutValueMatchesType");
    expect(service).toContain("defaultValue must match rolloutType");
  });
});
