import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const webRoot = resolve(import.meta.dirname, "../../apps/web/src");

describe("admin page integration wiring", () => {
  it("sample admin pages use AdminPageGate and serverApi", () => {
    const pagePaths = [
      "app/admin/page.tsx",
      "app/admin/config/page.tsx",
      "app/admin/exports/page.tsx",
      "app/admin/deletion-requests/page.tsx",
    ];

    for (const relativePath of pagePaths) {
      const source = readFileSync(resolve(webRoot, relativePath), "utf8");
      expect(source).toContain("AdminPageGate");
      expect(source).toContain("serverApi");
    }
  });

  it("admin pages do not import prisma, repositories, or platform clients", () => {
    const files = [
      "app/admin/page.tsx",
      "app/admin/config/page.tsx",
      "app/admin/feature-flags/page.tsx",
      "app/admin/entitlements/page.tsx",
      "app/admin/workflows/page.tsx",
      "app/admin/audit/page.tsx",
      "components/shells/TenantAdminShellGate.tsx",
      "lib/server/admin-shell-context.ts",
    ];

    for (const relativePath of files) {
      const source = readFileSync(resolve(webRoot, relativePath), "utf8");
      expect(source).not.toMatch(
        /from.*prisma|from.*repository|platformPrisma|withPlatformScope|PlatformConsoleShell/i,
      );
    }
  });

  it("admin exports page reuses Story 037 export jobs panel", () => {
    const source = readFileSync(resolve(webRoot, "app/admin/exports/page.tsx"), "utf8");
    expect(source).toContain("ExportJobsPanel");
    expect(source).toContain("/api/v1/exports");
  });
});
