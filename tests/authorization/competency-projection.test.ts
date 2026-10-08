import { describe, expect, it } from "vitest";
import { can, createTenantResourceRef } from "@atlas/authorization";
import { authorizationFactsQuery } from "../helpers/authorization-facts";

function learnerScoreReadTx() {
  return {
    $queryRaw: authorizationFactsQuery(
      [{ key: "competency.score.read" }],
      [],
      [{ role_key: "learner", bypasses_resource_predicates: false }],
    ),
  };
}

function instructorScoreReadTx() {
  return {
    $queryRaw: authorizationFactsQuery(
      [{ key: "competency.score.read" }],
      [],
      [{ role_key: "instructor", bypasses_resource_predicates: false }],
    ),
  };
}

function adminSignalReadTx() {
  return {
    $queryRaw: authorizationFactsQuery(
      [{ key: "competency.signal.read" }],
      [],
      [{ role_key: "admin", bypasses_resource_predicates: true }],
    ),
  };
}

function learnerWithoutSignalReadTx() {
  return {
    $queryRaw: authorizationFactsQuery([{ key: "competency.signal.read" }], [], []),
  };
}

describe("competency projection authorization", () => {
  it("allows learner to read own competency via self relationship", async () => {
    const decision = await can({
      tx: learnerScoreReadTx(),
      actor: { tenantId: "tenant-a", membershipId: "learner-a" },
      permission: "competency.score.read",
      resource: createTenantResourceRef({
        type: "competency_score",
        id: "learner-a",
        tenantId: "tenant-a",
        ownerMembershipId: "learner-a",
        relationships: { selfCompetencyScore: "learner-a" },
      }),
      ctx: { tenantId: "tenant-a", requestId: "req_auth" },
    });

    expect(decision.allowed).toBe(true);
  });

  it("denies learner reading another member without relationship", async () => {
    const decision = await can({
      tx: learnerScoreReadTx(),
      actor: { tenantId: "tenant-a", membershipId: "learner-a" },
      permission: "competency.score.read",
      resource: createTenantResourceRef({
        type: "competency_score",
        id: "learner-b",
        tenantId: "tenant-a",
        ownerMembershipId: "learner-b",
      }),
      ctx: { tenantId: "tenant-a", requestId: "req_auth" },
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("RELATIONSHIP_REQUIRED");
  });

  it("allows related instructor through instructorOfCourse relationship", async () => {
    const decision = await can({
      tx: instructorScoreReadTx(),
      actor: { tenantId: "tenant-a", membershipId: "instructor-a" },
      permission: "competency.score.read",
      resource: createTenantResourceRef({
        type: "competency_score",
        id: "learner-b",
        tenantId: "tenant-a",
        ownerMembershipId: "learner-b",
        relationships: { instructorOfCourse: "instructor-a" },
      }),
      ctx: { tenantId: "tenant-a", requestId: "req_auth" },
    });

    expect(decision.allowed).toBe(true);
  });

  it("denies unrelated instructor", async () => {
    const decision = await can({
      tx: instructorScoreReadTx(),
      actor: { tenantId: "tenant-a", membershipId: "instructor-a" },
      permission: "competency.score.read",
      resource: createTenantResourceRef({
        type: "competency_score",
        id: "learner-b",
        tenantId: "tenant-a",
        ownerMembershipId: "learner-b",
      }),
      ctx: { tenantId: "tenant-a", requestId: "req_auth" },
    });

    expect(decision.allowed).toBe(false);
  });

  it("allows admin raw signal read", async () => {
    const decision = await can({
      tx: adminSignalReadTx(),
      actor: { tenantId: "tenant-a", membershipId: "admin-a" },
      permission: "competency.signal.read",
      resource: createTenantResourceRef({
        type: "competency_signal_catalog",
        id: "tenant-a",
        tenantId: "tenant-a",
      }),
      ctx: { tenantId: "tenant-a", requestId: "req_auth" },
    });

    expect(decision.allowed).toBe(true);
  });

  it("denies learner raw signal read", async () => {
    const decision = await can({
      tx: learnerWithoutSignalReadTx(),
      actor: { tenantId: "tenant-a", membershipId: "learner-a" },
      permission: "competency.signal.read",
      resource: createTenantResourceRef({
        type: "competency_signal_catalog",
        id: "tenant-a",
        tenantId: "tenant-a",
      }),
      ctx: { tenantId: "tenant-a", requestId: "req_auth" },
    });

    expect(decision.allowed).toBe(false);
  });
});
