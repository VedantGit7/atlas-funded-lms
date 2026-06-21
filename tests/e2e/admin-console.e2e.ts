import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const webRoot = resolve(import.meta.dirname, "../../apps/web/src");

describe("admin console e2e wiring", () => {
  it("includes all T1-T24 page files", () => {
    const pages = [
      "app/admin/page.tsx",
      "app/admin/members/page.tsx",
      "app/admin/members/[id]/page.tsx",
      "app/admin/roles/page.tsx",
      "app/admin/roles/[id]/page.tsx",
      "app/admin/branding/page.tsx",
      "app/admin/domains/page.tsx",
      "app/admin/config/page.tsx",
      "app/admin/feature-flags/page.tsx",
      "app/admin/entitlements/page.tsx",
      "app/admin/competency/page.tsx",
      "app/admin/certificates/templates/page.tsx",
      "app/admin/certificates/page.tsx",
      "app/admin/gamification/page.tsx",
      "app/admin/notifications/templates/page.tsx",
      "app/admin/automation/page.tsx",
      "app/admin/workflows/page.tsx",
      "app/admin/locales/page.tsx",
      "app/admin/extensions/page.tsx",
      "app/admin/readiness-policy/page.tsx",
      "app/admin/analytics/page.tsx",
      "app/admin/audit/page.tsx",
      "app/admin/exports/page.tsx",
      "app/admin/deletion-requests/page.tsx",
    ];

    for (const page of pages) {
      expect(existsSync(resolve(webRoot, page))).toBe(true);
    }
  });

  it("admin dashboard links reuse studio, moderation, and review routes", () => {
    const source = readFileSync(resolve(webRoot, "app/admin/page.tsx"), "utf8");
    expect(source).toContain('href="/studio/courses"');
    expect(source).toContain('href="/moderate/cases"');
    expect(source).toContain('href="/review"');
    expect(source).not.toMatch(/\/admin\/courses|\/admin\/moderation|\/admin\/review/);
  });

  it("tenant admin shell exposes mobile navigation affordances", () => {
    const source = readFileSync(
      resolve(webRoot, "components/shells/TenantAdminShellClient.tsx"),
      "utf8",
    );
    expect(source).toContain("admin-mobile-nav");
    expect(source).toContain("Mobile admin navigation");
  });
});
