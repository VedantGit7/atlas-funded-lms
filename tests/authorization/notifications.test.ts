import { describe, expect, it } from "vitest";
import { can, createTenantResourceRef } from "@atlas/authorization";
import { authorizationFactsQuery } from "../helpers/authorization-facts";

function adminTx() {
  return {
    $queryRaw: authorizationFactsQuery(
      [{ key: "notification.template.manage" }],
      [],
      [{ role_key: "admin", bypasses_resource_predicates: true }],
    ),
  };
}

function learnerTx() {
  return {
    $queryRaw: authorizationFactsQuery(
      [{ key: "notification.read.self" }],
      [],
      [{ role_key: "learner", bypasses_resource_predicates: false }],
    ),
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
        $queryRaw: authorizationFactsQuery(
          [{ key: "notification.template.read" }],
          [{ permission_key: "notification.template.read", effect: "DENY" }],
          [{ role_key: "admin", bypasses_resource_predicates: true }],
        ),
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
