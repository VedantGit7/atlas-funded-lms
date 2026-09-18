import { describe, expect, it, vi } from "vitest";
import { can, createTenantResourceRef } from "@atlas/authorization";

function adminTx() {
  return {
    $queryRaw: vi
      .fn()
      .mockResolvedValueOnce([{ key: "analytics.dashboard.view" }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ role_key: "admin", bypasses_resource_predicates: true }]),
  };
}

function instructorTx() {
  return {
    $queryRaw: vi
      .fn()
      .mockResolvedValueOnce([{ key: "analytics.dashboard.view" }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ role_key: "instructor", bypasses_resource_predicates: false }]),
  };
}

describe("analytics authorization", () => {
  it("allows admin tenant-wide analytics dashboard", async () => {
    const decision = await can({
      tx: adminTx(),
      actor: { tenantId: "tenant-a", membershipId: "admin-a" },
      permission: "analytics.dashboard.view",
      resource: createTenantResourceRef({
        type: "analytics_rollup",
        id: "tenant-a",
        tenantId: "tenant-a",
      }),
      ctx: { tenantId: "tenant-a", requestId: "req_analytics_admin" },
    });

    expect(decision.allowed).toBe(true);
  });

  it("denies instructor without course relationship on tenant dashboard", async () => {
    const decision = await can({
      tx: instructorTx(),
      actor: { tenantId: "tenant-a", membershipId: "instructor-a" },
      permission: "analytics.dashboard.view",
      resource: createTenantResourceRef({
        type: "analytics_rollup",
        id: "tenant-a",
        tenantId: "tenant-a",
      }),
      ctx: { tenantId: "tenant-a", requestId: "req_analytics_instructor_denied" },
    });

    expect(decision.allowed).toBe(false);
  });

  it("allows instructor with course relationship", async () => {
    const decision = await can({
      tx: instructorTx(),
      actor: { tenantId: "tenant-a", membershipId: "instructor-a" },
      permission: "analytics.dashboard.view",
      resource: createTenantResourceRef({
        type: "course",
        id: "course-a",
        tenantId: "tenant-a",
        relationships: {
          instructorOfCourse: "instructor-a",
        },
      }),
      ctx: { tenantId: "tenant-a", requestId: "req_analytics_instructor_allowed" },
    });

    expect(decision.allowed).toBe(true);
  });

  it("allows analytics.funnel.view for admin", async () => {
    const tx = {
      $queryRaw: vi
        .fn()
        .mockResolvedValueOnce([{ key: "analytics.funnel.view" }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ role_key: "admin", bypasses_resource_predicates: true }]),
    };

    const decision = await can({
      tx,
      actor: { tenantId: "tenant-a", membershipId: "admin-a" },
      permission: "analytics.funnel.view",
      resource: createTenantResourceRef({
        type: "funnel_daily_rollup",
        id: "tenant-a",
        tenantId: "tenant-a",
      }),
      ctx: { tenantId: "tenant-a", requestId: "req_analytics_funnel" },
    });

    expect(decision.allowed).toBe(true);
  });
});
