import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { listAdminScreenIds } from "../../apps/web/src/features/admin/admin-route-registry";

const webRoot = resolve(import.meta.dirname, "../../apps/web/src");

const adminPages: Record<string, string> = {
  T1: "app/admin/page.tsx",
  T2: "app/admin/members/page.tsx",
  T3: "app/admin/members/[id]/page.tsx",
  T4: "app/admin/roles/page.tsx",
  T5: "app/admin/roles/[id]/page.tsx",
  T6: "app/admin/branding/page.tsx",
  T7: "app/admin/domains/page.tsx",
  T8: "app/admin/config/page.tsx",
  T9: "app/admin/feature-flags/page.tsx",
  T10: "app/admin/entitlements/page.tsx",
  T11: "app/admin/competency/page.tsx",
  T12: "app/admin/certificates/templates/page.tsx",
  T13: "app/admin/certificates/page.tsx",
  T14: "app/admin/gamification/page.tsx",
  T15: "app/admin/notifications/templates/page.tsx",
  T16: "app/admin/automation/page.tsx",
  T17: "app/admin/workflows/page.tsx",
  T18: "app/admin/locales/page.tsx",
  T19: "app/admin/extensions/page.tsx",
  T20: "app/admin/readiness-policy/page.tsx",
  T21: "app/admin/analytics/page.tsx",
  T22: "app/admin/audit/page.tsx",
  T23: "app/admin/exports/page.tsx",
  T24: "app/admin/deletion-requests/page.tsx",
};

describe("admin page authorization patterns", () => {
  for (const screenId of listAdminScreenIds()) {
    it(`${screenId} uses AdminPageGate and handles denied auth states`, () => {
      const relativePath = adminPages[screenId];
      expect(relativePath).toBeTruthy();
      if (!relativePath) {
        throw new Error(`Missing page mapping for ${screenId}`);
      }
      expect(existsSync(resolve(webRoot, relativePath))).toBe(true);
      const source = readFileSync(resolve(webRoot, relativePath), "utf8");
      expect(source).toContain("AdminPageGate");
      expect(source).toMatch(/ServerApiError|401|403|denied|not_found/);
    });
  }

  it("admin layout mounts TenantAdminShell before page content", () => {
    const layout = readFileSync(resolve(webRoot, "app/admin/layout.tsx"), "utf8");
    expect(layout).toContain("TenantAdminShell");
  });

  it("T10 performs only GET entitlements", () => {
    const relativePath = adminPages.T10;
    if (!relativePath) {
      throw new Error("Missing T10 page mapping");
    }
    const source = readFileSync(resolve(webRoot, relativePath), "utf8");
    expect(source).toMatch(/GET.*\/api\/v1\/entitlements|get<.*>\("\/api\/v1\/entitlements"\)/);
    expect(source).not.toMatch(
      /\/api\/v1\/entitlements.*PUT|POST.*entitlements|DELETE.*entitlements/i,
    );
  });
});
