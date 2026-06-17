import { describe, expect, it, vi } from "vitest";
import { can, createTenantResourceRef } from "@atlas/authorization";

describe("can permission overrides", () => {
  it("denies when an explicit DENY override exists", async () => {
    const tx = {
      $queryRaw: vi
        .fn()
        .mockResolvedValueOnce([{ key: "membership.read" }])
        .mockResolvedValueOnce([{ effect: "DENY", permission_key: "membership.read" }]),
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

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("EXPLICIT_DENY");
  });

  it("allows explicit ALLOW override without a role grant when predicates pass", async () => {
    const tx = {
      $queryRaw: vi
        .fn()
        .mockResolvedValueOnce([{ key: "profile.update" }])
        .mockResolvedValueOnce([{ effect: "ALLOW", permission_key: "profile.update" }])
        .mockResolvedValueOnce([]),
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

  it("still enforces ownership predicates for explicit ALLOW overrides", async () => {
    const tx = {
      $queryRaw: vi
        .fn()
        .mockResolvedValueOnce([{ key: "profile.update" }])
        .mockResolvedValueOnce([{ effect: "ALLOW", permission_key: "profile.update" }])
        .mockResolvedValueOnce([]),
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
