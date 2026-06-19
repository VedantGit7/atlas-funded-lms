import { describe, expect, it, vi } from "vitest";
import { can, createTenantResourceRef } from "@atlas/authorization";

function learnerScoreReadTx() {
  return {
    $queryRaw: vi
      .fn()
      .mockResolvedValueOnce([{ key: "competency.score.read" }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ role_key: "learner" }]),
  };
}

function instructorScoreReadTx() {
  return {
    $queryRaw: vi
      .fn()
      .mockResolvedValueOnce([{ key: "competency.score.read" }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ role_key: "instructor" }]),
  };
}

function adminSignalReadTx() {
  return {
    $queryRaw: vi
      .fn()
      .mockResolvedValueOnce([{ key: "competency.signal.read" }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ role_key: "admin" }]),
  };
}

function learnerWithoutSignalReadTx() {
  return {
    $queryRaw: vi
      .fn()
      .mockResolvedValueOnce([{ key: "competency.signal.read" }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]),
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
