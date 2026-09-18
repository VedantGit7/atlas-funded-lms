import { describe, expect, it, vi } from "vitest";
import { can, createTenantResourceRef } from "@atlas/authorization";

describe("can ownership predicates", () => {
  it("allows owner-bound permission when actor owns resource", async () => {
    const tx = {
      $queryRaw: vi
        .fn()
        .mockResolvedValueOnce([{ key: "profile.update" }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ role_key: "learner", bypasses_resource_predicates: false }]),
    };

    const decision = await can({
      tx,
      actor: { tenantId: "tenant-a", membershipId: "member-a" },
      permission: "profile.update",
      resource: createTenantResourceRef({
        type: "member_profile",
        id: "profile-a",
        tenantId: "tenant-a",
        ownerMembershipId: "member-a",
      }),
      ctx: { tenantId: "tenant-a", requestId: "req_test" },
    });

    expect(decision.allowed).toBe(true);
  });

  it("denies owner-bound permission when actor does not own resource", async () => {
    const tx = {
      $queryRaw: vi
        .fn()
        .mockResolvedValueOnce([{ key: "profile.update" }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ role_key: "learner", bypasses_resource_predicates: false }]),
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

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("OWNERSHIP_REQUIRED");
  });
});
