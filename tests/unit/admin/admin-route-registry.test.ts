import { describe, expect, it } from "vitest";
import {
  ADMIN_ROUTE_REGISTRY,
  ADMIN_REUSE_ROUTE_REGISTRY,
  FORBIDDEN_ADMIN_DUPLICATE_ROUTES,
  getAdminRouteByScreenId,
  listAdminScreenIds,
} from "../../../frontend/apps/web/src/features/admin/admin-route-registry";

describe("admin route registry", () => {
  it("defines exact T1-T100 contract registry", () => {
    const screenIds = [...new Set(listAdminScreenIds())];
    expect(screenIds).toHaveLength(100);
    expect(screenIds[0]).toBe("T1");
    expect(screenIds[99]).toBe("T100");
  });

  it("maps known screens to approved paths", () => {
    expect(getAdminRouteByScreenId("T1").pathPattern).toBe("/admin");
    expect(getAdminRouteByScreenId("T10").pathPattern).toBe("/admin/entitlements");
    expect(getAdminRouteByScreenId("T23").pathPattern).toBe("/admin/exports");
    expect(getAdminRouteByScreenId("T24").pathPattern).toBe("/admin/deletion-requests");
    expect(getAdminRouteByScreenId("T25").pathPattern).toBe("/admin/review");
    expect(getAdminRouteByScreenId("T27").pathPattern).toBe("/admin/settings");
    expect(getAdminRouteByScreenId("T28").pathPattern).toBe("/admin/billing");
    expect(getAdminRouteByScreenId("T29").pathPattern).toBe("/admin/timezones");
    expect(getAdminRouteByScreenId("T30").pathPattern).toBe("/admin/video-quality");
    expect(getAdminRouteByScreenId("T31").pathPattern).toBe("/admin/seo");
    expect(getAdminRouteByScreenId("T32").pathPattern).toBe("/admin/learner-billing/pricing-model");
    expect(getAdminRouteByScreenId("T38").pathPattern).toBe("/admin/learner-billing/locations");
    expect(getAdminRouteByScreenId("T39").pathPattern).toBe("/admin/fast-checkout");
    expect(getAdminRouteByScreenId("T40").pathPattern).toBe(
      "/admin/security/learner-email-verification",
    );
    expect(getAdminRouteByScreenId("T42").pathPattern).toBe("/admin/security/device-monitor");
    expect(getAdminRouteByScreenId("T43").pathPattern).toBe("/admin/channels/transactional-email");
    expect(getAdminRouteByScreenId("T45").pathPattern).toBe("/admin/channels/support-email");
    expect(getAdminRouteByScreenId("T46").pathPattern).toBe("/admin/trash");
    expect(getAdminRouteByScreenId("T47").pathPattern).toBe("/admin/trash/activity");
    expect(getAdminRouteByScreenId("T48").pathPattern).toBe("/admin/reports");
    expect(getAdminRouteByScreenId("T49").pathPattern).toBe("/admin/insights");
    expect(getAdminRouteByScreenId("T50").pathPattern).toBe("/admin/reports/:slug");
    expect(getAdminRouteByScreenId("T51").pathPattern).toBe("/admin/insights/:slug");
    expect(getAdminRouteByScreenId("T58").pathPattern).toBe("/admin/manage");
    expect(getAdminRouteByScreenId("T59").pathPattern).toBe("/admin/sub-schools");
    expect(getAdminRouteByScreenId("T60").pathPattern).toBe("/admin/manage/:slug");
    expect(getAdminRouteByScreenId("T61").pathPattern).toBe("/admin/sub-schools/:id");
    expect(getAdminRouteByScreenId("T62").pathPattern).toBe("/admin/sub-schools/:id/copy-product");
    expect(getAdminRouteByScreenId("T63").pathPattern).toBe(
      "/admin/sub-schools/:id/copy-product/course",
    );
    expect(getAdminRouteByScreenId("T64").pathPattern).toBe(
      "/admin/sub-schools/:id/copy-product/mock-test",
    );
    expect(getAdminRouteByScreenId("T65").pathPattern).toBe(
      "/admin/sub-schools/:id/copy-product/test-series",
    );
    expect(getAdminRouteByScreenId("T66").pathPattern).toBe("/admin/marketing");
    expect(getAdminRouteByScreenId("T67").pathPattern).toBe("/admin/sales");
    expect(getAdminRouteByScreenId("T68").pathPattern).toBe("/admin/marketing/:slug");
    expect(getAdminRouteByScreenId("T69").pathPattern).toBe("/admin/sales/:slug");
    expect(getAdminRouteByScreenId("T70").pathPattern).toBe("/admin/marketing/messenger/push");
    expect(getAdminRouteByScreenId("T71").pathPattern).toBe(
      "/admin/marketing/messenger/push/create",
    );
    expect(getAdminRouteByScreenId("T72").pathPattern).toBe("/admin/marketing/messenger/push/:id");
    expect(getAdminRouteByScreenId("T73").pathPattern).toBe("/admin/marketing/messenger/email");
    expect(getAdminRouteByScreenId("T74").pathPattern).toBe(
      "/admin/marketing/messenger/email/create",
    );
    expect(getAdminRouteByScreenId("T75").pathPattern).toBe("/admin/marketing/messenger/email/:id");
    expect(getAdminRouteByScreenId("T76").pathPattern).toBe(
      "/admin/marketing/messenger/system-email",
    );
    expect(getAdminRouteByScreenId("T77").pathPattern).toBe(
      "/admin/marketing/messenger/system-email/:key",
    );
    expect(getAdminRouteByScreenId("T78").pathPattern).toBe(
      "/admin/marketing/messenger/announcements",
    );
    expect(getAdminRouteByScreenId("T79").pathPattern).toBe(
      "/admin/marketing/messenger/announcements/create",
    );
    expect(getAdminRouteByScreenId("T80").pathPattern).toBe("/admin/marketing/messenger/whatsapp");
    expect(getAdminRouteByScreenId("T81").pathPattern).toBe(
      "/admin/marketing/messenger/whatsapp/create",
    );
    expect(getAdminRouteByScreenId("T82").pathPattern).toBe(
      "/admin/marketing/messenger/whatsapp/:id",
    );
    expect(getAdminRouteByScreenId("T83").pathPattern).toBe(
      "/admin/marketing/messenger/whatsapp/templates",
    );
    expect(getAdminRouteByScreenId("T84").pathPattern).toBe(
      "/admin/marketing/messenger/whatsapp/inbox",
    );
    expect(getAdminRouteByScreenId("T85").pathPattern).toBe("/admin/marketing/workflows/create");
    expect(getAdminRouteByScreenId("T86").pathPattern).toBe("/admin/marketing/workflows/:id");
    expect(getAdminRouteByScreenId("T87").pathPattern).toBe("/admin/marketing/forms/create");
    expect(getAdminRouteByScreenId("T88").pathPattern).toBe("/admin/marketing/forms/:id");
    expect(getAdminRouteByScreenId("T89").pathPattern).toBe(
      "/admin/marketing/forms/:id/submissions",
    );
    expect(getAdminRouteByScreenId("T90").pathPattern).toBe("/admin/marketing/forms/contacts");
    expect(getAdminRouteByScreenId("T91").pathPattern).toBe("/admin/marketing/cta/create");
    expect(getAdminRouteByScreenId("T92").pathPattern).toBe("/admin/marketing/cta/:id");
    expect(getAdminRouteByScreenId("T93").pathPattern).toBe("/admin/marketing/promo-slider/create");
    expect(getAdminRouteByScreenId("T94").pathPattern).toBe("/admin/marketing/promo-slider/:id");
    expect(getAdminRouteByScreenId("T95").pathPattern).toBe("/admin/marketing/events/create");
    expect(getAdminRouteByScreenId("T96").pathPattern).toBe("/admin/marketing/events/:id");
    expect(getAdminRouteByScreenId("T97").pathPattern).toBe("/admin/marketing/newsfeed/create");
    expect(getAdminRouteByScreenId("T98").pathPattern).toBe("/admin/marketing/newsfeed/:id");
    expect(getAdminRouteByScreenId("T99").pathPattern).toBe("/admin/sales/coupons/create");
    expect(getAdminRouteByScreenId("T100").pathPattern).toBe("/admin/sales/coupons/:id");
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
      "/admin/moderation/cases",
      "/admin/moderation/appeals",
      "/admin/review",
    ]);
  });
});
