import { describe, expect, it } from "vitest";
import { can, createTenantResourceRef } from "@atlas/authorization";
import { postBadgesBodySchema } from "../../backend/apps/api/src/server/gamification/gamification.schemas";
import { authorizationFactsQuery } from "../helpers/authorization-facts";

function adminTx() {
  return {
    $queryRaw: authorizationFactsQuery(
      [{ key: "badge.manage" }],
      [],
      [{ role_key: "admin", bypasses_resource_predicates: true }],
    ),
  };
}

function learnerTx() {
  return {
    $queryRaw: authorizationFactsQuery(
      [{ key: "gamification.profile.read" }],
      [],
      [{ role_key: "learner", bypasses_resource_predicates: false }],
    ),
  };
}

function learnerWithoutManageTx() {
  return {
    $queryRaw: authorizationFactsQuery([{ key: "badge.manage" }], [], []),
  };
}

describe("gamification authorization", () => {
  it("allows learner self gamification profile read", async () => {
    const decision = await can({
      tx: learnerTx(),
      actor: { tenantId: "tenant-a", membershipId: "learner-a" },
      permission: "gamification.profile.read",
      resource: createTenantResourceRef({
        type: "gamification_profile",
        id: "learner-a",
        tenantId: "tenant-a",
        ownerMembershipId: "learner-a",
        relationships: { selfGamificationProfile: "learner-a" },
      }),
      ctx: { tenantId: "tenant-a", requestId: "req_auth" },
    });

    expect(decision.allowed).toBe(true);
  });

  it("denies learner badge.manage", async () => {
    const decision = await can({
      tx: learnerWithoutManageTx(),
      actor: { tenantId: "tenant-a", membershipId: "learner-a" },
      permission: "badge.manage",
      resource: createTenantResourceRef({
        type: "badge",
        id: "tenant-a",
        tenantId: "tenant-a",
      }),
      ctx: { tenantId: "tenant-a", requestId: "req_auth" },
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("NO_ROLE_GRANT");
  });

  it("allows admin badge.manage", async () => {
    const decision = await can({
      tx: adminTx(),
      actor: { tenantId: "tenant-a", membershipId: "admin-a" },
      permission: "badge.manage",
      resource: createTenantResourceRef({
        type: "badge",
        id: "tenant-a",
        tenantId: "tenant-a",
      }),
      ctx: { tenantId: "tenant-a", requestId: "req_auth" },
    });

    expect(decision.allowed).toBe(true);
  });

  it("rejects client tenant_id in manual award body", () => {
    expect(() =>
      postBadgesBodySchema.parse({
        operation: "manual_award",
        badgeId: "018f0000-0000-7000-8000-000000000001",
        membershipId: "018f0000-0000-7000-8000-000000000002",
        reason: "Award",
        tenant_id: "018f0000-0000-7000-8000-000000000099",
      }),
    ).toThrow();
  });
});
