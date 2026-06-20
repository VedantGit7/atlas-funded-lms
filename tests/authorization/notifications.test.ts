import { describe, expect, it, vi } from "vitest";
import { can, createTenantResourceRef } from "@atlas/authorization";

function adminTx() {
  return {
    $queryRaw: vi
      .fn()
      .mockResolvedValueOnce([{ key: "notification.template.manage" }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ role_key: "admin" }]),
  };
}

function learnerTx() {
  return {
    $queryRaw: vi
      .fn()
      .mockResolvedValueOnce([{ key: "notification.read.self" }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ role_key: "learner" }]),
  };
}

describe("notification authorization", () => {
  it("allows admin template manage", async () => {
    const decision = await can({
      tx: adminTx(),
      actor: { tenantId: "tenant-a", membershipId: "admin-a" },
      permission: "notification.template.manage",
      resource: createTenantResourceRef({
        type: "notification_template_catalog",
        id: "tenant-a",
        tenantId: "tenant-a",
      }),
      ctx: { tenantId: "tenant-a", requestId: "req_auth_template" },
    });

    expect(decision.allowed).toBe(true);
  });

  it("allows learner self inbox read", async () => {
    const decision = await can({
      tx: learnerTx(),
      actor: { tenantId: "tenant-a", membershipId: "learner-a" },
      permission: "notification.read.self",
      resource: createTenantResourceRef({
        type: "notification_dispatch",
        id: "dispatch-a",
        tenantId: "tenant-a",
        ownerMembershipId: "learner-a",
      }),
      ctx: { tenantId: "tenant-a", requestId: "req_auth_inbox" },
    });

    expect(decision.allowed).toBe(true);
  });

  it("denies self read for another membership", async () => {
    const decision = await can({
      tx: learnerTx(),
      actor: { tenantId: "tenant-a", membershipId: "learner-a" },
      permission: "notification.read.self",
      resource: createTenantResourceRef({
        type: "notification_dispatch",
        id: "dispatch-a",
        tenantId: "tenant-a",
        ownerMembershipId: "learner-b",
      }),
      ctx: { tenantId: "tenant-a", requestId: "req_auth_deny" },
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("OWNERSHIP_REQUIRED");
  });

  it("deny override wins for template read", async () => {
    const decision = await can({
      tx: {
        $queryRaw: vi
          .fn()
          .mockResolvedValueOnce([{ key: "notification.template.read" }])
          .mockResolvedValueOnce([{ permission_key: "notification.template.read", effect: "DENY" }])
          .mockResolvedValueOnce([{ role_key: "admin" }]),
      },
      actor: { tenantId: "tenant-a", membershipId: "admin-a" },
      permission: "notification.template.read",
      resource: createTenantResourceRef({
        type: "notification_template_catalog",
        id: "tenant-a",
        tenantId: "tenant-a",
      }),
      ctx: { tenantId: "tenant-a", requestId: "req_auth_override" },
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("EXPLICIT_DENY");
  });
});
