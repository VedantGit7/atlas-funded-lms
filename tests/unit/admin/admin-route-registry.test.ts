import { describe, expect, it } from "vitest";
import {
  ADMIN_ROUTE_REGISTRY,
  ADMIN_REUSE_ROUTE_REGISTRY,
  FORBIDDEN_ADMIN_DUPLICATE_ROUTES,
  getAdminRouteByScreenId,
  listAdminScreenIds,
} from "../../../apps/web/src/features/admin/admin-route-registry";

describe("admin route registry", () => {
  it("defines exact T1-T24 contract registry", () => {
    const screenIds = listAdminScreenIds();
    expect(screenIds).toHaveLength(24);
    expect(screenIds[0]).toBe("T1");
    expect(screenIds[23]).toBe("T24");
  });

  it("maps known screens to approved paths", () => {
    expect(getAdminRouteByScreenId("T1").pathPattern).toBe("/admin");
    expect(getAdminRouteByScreenId("T10").pathPattern).toBe("/admin/entitlements");
    expect(getAdminRouteByScreenId("T23").pathPattern).toBe("/admin/exports");
    expect(getAdminRouteByScreenId("T24").pathPattern).toBe("/admin/deletion-requests");
  });

  it("does not register forbidden duplicate admin content routes", () => {
    for (const forbidden of FORBIDDEN_ADMIN_DUPLICATE_ROUTES) {
      expect(ADMIN_ROUTE_REGISTRY.some((entry) => entry.pathPattern === forbidden)).toBe(false);
    }
  });

  it("declares route-level entitlements for gated admin screens", () => {
    expect(getAdminRouteByScreenId("T7").entitlement).toBe("branding.custom_domain.enable");
    expect(getAdminRouteByScreenId("T12").entitlement).toBe("certification.enable");
    expect(getAdminRouteByScreenId("T21").entitlement).toBe("analytics.dashboard.view");
    expect(getAdminRouteByScreenId("T23").entitlement).toBe("data.export.enable");
  });

  it("reuses studio, moderation, and review paths without duplicating admin routes", () => {
    expect(ADMIN_REUSE_ROUTE_REGISTRY.map((entry) => entry.pathPattern)).toEqual([
      "/studio/courses",
      "/moderate/cases",
      "/review",
    ]);
  });
});
