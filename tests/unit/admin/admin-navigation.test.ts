import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ADMIN_PRIMARY_NAV,
  filterAdminNavigation,
} from "../../../frontend/apps/web/src/features/admin/admin-navigation";

const webRoot = resolve(import.meta.dirname, "../../../frontend/apps/web/src");

describe("admin navigation", () => {
  it("includes moderation queue, appeals, studio, and review in admin nav", () => {
    const hrefs = ADMIN_PRIMARY_NAV.map((item) => item.href);
    expect(hrefs).toContain("/studio/courses");
    expect(hrefs).toContain("/admin/moderation/cases");
    expect(hrefs).toContain("/admin/moderation/appeals");
    expect(hrefs).toContain("/admin/review");
  });

  it("hides entitlement-gated nav items when entitlement is disabled", () => {
    const filtered = filterAdminNavigation(ADMIN_PRIMARY_NAV, {
      enabledEntitlements: new Set(["community.enable"]),
      canAccessWorkflowReview: true,
      canAccessStudio: true,
      canAccessModeration: true,
      canAccessAppealsReview: true,
    });

    expect(filtered.some((item) => item.href === "/admin/analytics")).toBe(false);
    expect(filtered.some((item) => item.href === "/admin/gamification")).toBe(false);
    expect(filtered.some((item) => item.href === "/admin/exports")).toBe(false);
  });

  it("never links to platform or forbidden duplicate admin routes", () => {
    const source = readFileSync(resolve(webRoot, "features/admin/admin-navigation.ts"), "utf8");
    expect(source).not.toMatch(/\/platform|\/admin\/courses/);
  });

  it("includes grow and operate sections in admin nav", () => {
    const hrefs = ADMIN_PRIMARY_NAV.map((item) => item.href);
    expect(hrefs).toContain("/admin/marketing");
    expect(hrefs).toContain("/admin/sales");
    expect(hrefs).toContain("/admin/manage");
    expect(hrefs).toContain("/admin/sub-schools");
  });
});
