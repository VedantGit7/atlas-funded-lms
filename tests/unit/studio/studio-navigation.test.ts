import { describe, expect, it } from "vitest";
import {
  STUDIO_PRIMARY_NAV,
  filterStudioNavigation,
} from "../../../frontend/apps/web/src/features/studio/studio-navigation";

describe("studio navigation projection", () => {
  it("filters analytics when entitlement disabled", () => {
    const items = filterStudioNavigation(STUDIO_PRIMARY_NAV, {
      enabledEntitlements: new Set(),
      canAccessWorkflowReview: true,
    });

    expect(items.some((item) => item.href === "/studio/analytics")).toBe(false);
    expect(items.some((item) => item.href === "/studio/courses")).toBe(true);
  });

  it("hides review link without workflow capability", () => {
    const items = filterStudioNavigation(STUDIO_PRIMARY_NAV, {
      enabledEntitlements: new Set(["analytics.dashboard.view"]),
      canAccessWorkflowReview: false,
    });

    expect(items.some((item) => item.href === "/review")).toBe(false);
    expect(items.some((item) => item.href === "/studio/analytics")).toBe(true);
  });

  it("shows review link only with workflow capability", () => {
    const items = filterStudioNavigation(STUDIO_PRIMARY_NAV, {
      enabledEntitlements: new Set(),
      canAccessWorkflowReview: true,
    });

    expect(items.some((item) => item.href === "/review")).toBe(true);
  });

  it("does not branch on role names", () => {
    const source = STUDIO_PRIMARY_NAV.toString();
    expect(source).not.toMatch(/role\.name|membership\.role/);
  });

  it("does not expose admin moderation or platform navigation", () => {
    const hrefs = STUDIO_PRIMARY_NAV.map((item) => item.href).join("\n");
    expect(hrefs).not.toMatch(/\/admin|\/moderate|\/platform/);
  });
});
