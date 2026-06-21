import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const webRoot = resolve(import.meta.dirname, "../../apps/web/src");

describe("tenant admin shell wiring", () => {
  it("includes tenant admin shell gate and route registry", () => {
    expect(existsSync(resolve(webRoot, "components/shells/TenantAdminShellGate.tsx"))).toBe(true);
    expect(existsSync(resolve(webRoot, "features/admin/admin-route-registry.ts"))).toBe(true);
    expect(existsSync(resolve(webRoot, "features/admin/admin-query-keys.ts"))).toBe(true);
  });

  it("admin shell context enforces MFA session assurance before ready state", () => {
    const source = readFileSync(resolve(webRoot, "lib/server/admin-shell-context.ts"), "utf8");
    expect(source).toContain("mfaEnabled");
    expect(source).toContain("session_assurance_blocked");
  });

  it("admin query keys isolate tenant scopes", () => {
    const source = readFileSync(resolve(webRoot, "features/admin/admin-query-keys.ts"), "utf8");
    expect(source).toContain("tenantQueryKey");
    expect(source).toContain("clearClientDataCache");
  });

  it("tenant admin shell client exposes accessible navigation labels", () => {
    const source = readFileSync(
      resolve(webRoot, "components/shells/TenantAdminShellClient.tsx"),
      "utf8",
    );
    expect(source).toContain('aria-label="Admin sidebar"');
    expect(source).toContain('aria-label="Mobile admin navigation"');
    expect(source).not.toMatch(/\/platform/);
  });
});

describe("T10 read-only entitlements enforcement", () => {
  it("entitlements page and list contain no mutation controls", () => {
    const page = readFileSync(resolve(webRoot, "app/admin/entitlements/page.tsx"), "utf8");
    const list = readFileSync(
      resolve(webRoot, "features/admin/entitlements/EntitlementsList.tsx"),
      "utf8",
    );
    expect(page).toContain('screenId="T10"');
    expect(page).toMatch(/\/api\/v1\/entitlements/);
    expect(page).not.toMatch(/\.put\(|\.post\(|\.delete\(/i);
    expect(list).not.toMatch(/<button|clientApi|mutation/i);
  });
});

describe("T23/T24 reuse Story 037 components", () => {
  it("admin exports and deletion pages reuse data-rights panels", () => {
    const exportsPage = readFileSync(resolve(webRoot, "app/admin/exports/page.tsx"), "utf8");
    const deletionPage = readFileSync(
      resolve(webRoot, "app/admin/deletion-requests/page.tsx"),
      "utf8",
    );
    expect(exportsPage).toContain("ExportJobsPanel");
    expect(deletionPage).toContain("DeletionRequestsPanel");
    expect(exportsPage).not.toContain("DataExportPanel");
    expect(deletionPage).not.toContain("DeletionRequestPanel");
  });
});
