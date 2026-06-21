import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ADMIN_PRIMARY_NAV,
  filterAdminNavigation,
} from "../../../apps/web/src/features/admin/admin-navigation";

const webRoot = resolve(import.meta.dirname, "../../../apps/web/src");

describe("admin navigation", () => {
  it("includes reuse links to studio, moderation, and review", () => {
    const hrefs = ADMIN_PRIMARY_NAV.map((item) => item.href);
    expect(hrefs).toContain("/studio/courses");
    expect(hrefs).toContain("/moderate/cases");
    expect(hrefs).toContain("/review");
  });

  it("hides entitlement-gated nav items when entitlement is disabled", () => {
    const filtered = filterAdminNavigation(ADMIN_PRIMARY_NAV, {
      enabledEntitlements: new Set(["community.enable"]),
      canAccessWorkflowReview: true,
      canAccessStudio: true,
      canAccessModeration: true,
    });

    expect(filtered.some((item) => item.href === "/admin/analytics")).toBe(false);
    expect(filtered.some((item) => item.href === "/admin/gamification")).toBe(false);
    expect(filtered.some((item) => item.href === "/admin/exports")).toBe(false);
  });

  it("never links to platform or forbidden duplicate admin routes", () => {
    const source = readFileSync(resolve(webRoot, "features/admin/admin-navigation.ts"), "utf8");
    expect(source).not.toMatch(/\/platform|\/admin\/courses|\/admin\/moderation|\/admin\/review/);
  });
});
