import { describe, expect, it, vi } from "vitest";
import { can, createTenantResourceRef } from "@atlas/authorization";

describe("can default deny", () => {
  it("denies when no role grant or override exists", async () => {
    const tx = {
      $queryRaw: vi
        .fn()
        .mockResolvedValueOnce([{ key: "membership.read" }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]),
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
    expect(decision.reason).toBe("NO_ROLE_GRANT");
  });
});
