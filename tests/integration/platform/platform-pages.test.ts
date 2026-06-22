import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const webRoot = resolve(import.meta.dirname, "../../../apps/web/src");

describe("platform console integration wiring", () => {
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

  it("includes all P1-P8 page files", () => {
    for (const page of pages) {
      expect(existsSync(resolve(webRoot, page))).toBe(true);
    }
  });

  it("does not import tenant shells or prisma repositories in platform features", () => {
    const forbidden = [
      "features/platform/platform-api.ts",
      "features/platform/components/PlatformTenantListClient.tsx",
      "features/platform/components/DeadLetterEventTable.tsx",
    ];

    for (const file of forbidden) {
      const source = readFileSync(resolve(webRoot, file), "utf8");
      expect(source).not.toMatch(/from.*prisma|from.*repository|TenantAdminShell|LearnerShell/i);
    }
  });

  it("uses internal read projections for P7 and P8 without GET list routes", () => {
    const support = readFileSync(
      resolve(webRoot, "features/platform/components/SupportSessionPanel.tsx"),
      "utf8",
    );
    const eventing = readFileSync(
      resolve(webRoot, "features/platform/components/DeadLetterEventTable.tsx"),
      "utf8",
    );
    expect(support).toContain("loadActiveSupportSessionsAction");
    expect(eventing).toContain("loadDeadLetterListAction");
    expect(support).not.toMatch(/GET.*support\/sessions/i);
    expect(eventing).not.toMatch(/GET.*dead-letter|GET.*eventing/i);
  });

  it("wires platform API client with reason header transport", () => {
    const api = readFileSync(resolve(webRoot, "features/platform/platform-api.ts"), "utf8");
    expect(api).toContain("ATLAS_PLATFORM_REASON_HEADER");
  });
});
