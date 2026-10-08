import { describe, expect, it, vi } from "vitest";
import { can, createTenantResourceRef } from "@atlas/authorization";
import { authorizationFactsQuery } from "../helpers/authorization-facts";

describe("members route IDOR protection via can()", () => {
  it("denies membership.read on another tenant membership collection", async () => {
    const tx = {
      $queryRaw: vi.fn(),
    };

    const decision = await can({
      tx,
      actor: { tenantId: "tenant-a", membershipId: "member-a" },
      permission: "membership.read",
      resource: createTenantResourceRef({
        type: "membership_collection",
        id: "tenant-b",
        tenantId: "tenant-b",
      }),
      ctx: { tenantId: "tenant-a", requestId: "req_test" },
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("TENANT_MISMATCH");
    expect(tx.$queryRaw).not.toHaveBeenCalled();
  });

  it("denies learners without membership.read even inside the same tenant", async () => {
    const tx = {
      $queryRaw: authorizationFactsQuery([{ key: "membership.read" }], [], []),
    };

    const decision = await can({
      tx,
      actor: { tenantId: "tenant-a", membershipId: "learner-a" },
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
