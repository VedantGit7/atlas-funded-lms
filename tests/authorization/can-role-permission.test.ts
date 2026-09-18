import { describe, expect, it, vi } from "vitest";
import { can, createTenantResourceRef } from "@atlas/authorization";

describe("can role permission grants", () => {
  it("allows when a role grants the requested permission", async () => {
    const tx = {
      $queryRaw: vi
        .fn()
        .mockResolvedValueOnce([{ key: "membership.read" }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ role_key: "admin", bypasses_resource_predicates: true }]),
    };

    const decision = await can({
      tx,
      actor: { tenantId: "tenant-a", membershipId: "member-a" },
      permission: "membership.read",
      resource: createTenantResourceRef({
        type: "membership_collection",
        id: "tenant-a",
        tenantId: "tenant-a",
      }),
      ctx: { tenantId: "tenant-a", requestId: "req_test" },
    });

    expect(decision.allowed).toBe(true);
    if (decision.allowed) {
      expect(decision.matchedRoleKeys).toEqual(["admin"]);
      expect(decision.bypassedResourcePredicate).toBe(true);
    }
  });

  it("bypasses ownership predicates for owner and admin roles", async () => {
    const tx = {
      $queryRaw: vi
        .fn()
        .mockResolvedValueOnce([{ key: "profile.update" }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ role_key: "owner", bypasses_resource_predicates: true }]),
    };

    const decision = await can({
      tx,
      actor: { tenantId: "tenant-a", membershipId: "member-a" },
      permission: "profile.update",
      resource: createTenantResourceRef({
        type: "member_profile",
        id: "profile-b",
        tenantId: "tenant-a",
        ownerMembershipId: "member-b",
      }),
      ctx: { tenantId: "tenant-a", requestId: "req_test" },
    });

    expect(decision.allowed).toBe(true);
  });
});
