import { describe, expect, it, vi } from "vitest";
import { can, createTenantResourceRef } from "@atlas/authorization";

function instructorTx() {
  return {
    $queryRaw: vi
      .fn()
      .mockResolvedValueOnce([{ key: "assessment.create" }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ role_key: "instructor" }]),
  };
}

function learnerAssessmentReadTx() {
  return {
    $queryRaw: vi
      .fn()
      .mockResolvedValueOnce([{ key: "assessment.read" }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ role_key: "learner" }]),
  };
}

function learnerWithoutCreateTx() {
  return {
    $queryRaw: vi
      .fn()
      .mockResolvedValueOnce([{ key: "assessment.create" }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]),
  };
}

describe("assessment authorization", () => {
  it("allows instructor assessment.create", async () => {
    const decision = await can({
      tx: instructorTx(),
      actor: { tenantId: "tenant-a", membershipId: "instructor-a" },
      permission: "assessment.create",
      resource: createTenantResourceRef({
        type: "assessment",
        id: "tenant-a",
        tenantId: "tenant-a",
      }),
      ctx: { tenantId: "tenant-a", requestId: "req_assessment_create" },
    });

    expect(decision.allowed).toBe(true);
  });

  it("denies learner assessment.create", async () => {
    const decision = await can({
      tx: learnerWithoutCreateTx(),
      actor: { tenantId: "tenant-a", membershipId: "learner-a" },
      permission: "assessment.create",
      resource: createTenantResourceRef({
        type: "assessment",
        id: "tenant-a",
        tenantId: "tenant-a",
      }),
      ctx: { tenantId: "tenant-a", requestId: "req_assessment_create_denied" },
    });

    expect(decision.allowed).toBe(false);
  });

  it("denies assessment.update for non-owner instructor", async () => {
    const decision = await can({
      tx: instructorTx(),
      actor: { tenantId: "tenant-a", membershipId: "instructor-a" },
      permission: "assessment.update",
      resource: createTenantResourceRef({
        type: "assessment",
        id: "assessment-b",
        tenantId: "tenant-a",
        ownerMembershipId: "instructor-b",
      }),
      ctx: { tenantId: "tenant-a", requestId: "req_assessment_update_denied" },
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("OWNERSHIP_REQUIRED");
  });

  it("allows owner assessment.update", async () => {
    const decision = await can({
      tx: instructorTx(),
      actor: { tenantId: "tenant-a", membershipId: "instructor-a" },
      permission: "assessment.update",
      resource: createTenantResourceRef({
        type: "assessment",
        id: "assessment-a",
        tenantId: "tenant-a",
        ownerMembershipId: "instructor-a",
      }),
      ctx: { tenantId: "tenant-a", requestId: "req_assessment_update" },
    });

    expect(decision.allowed).toBe(true);
  });

  it("allows learner attempt.read on self attempt", async () => {
    const decision = await can({
      tx: learnerAssessmentReadTx(),
      actor: { tenantId: "tenant-a", membershipId: "learner-a" },
      permission: "attempt.read",
      resource: createTenantResourceRef({
        type: "attempt",
        id: "attempt-a",
        tenantId: "tenant-a",
        ownerMembershipId: "learner-a",
        relationships: { selfAttempt: "learner-a" },
      }),
      ctx: { tenantId: "tenant-a", requestId: "req_attempt_read_self" },
    });

    expect(decision.allowed).toBe(true);
  });

  it("denies learner attempt.read on another learner attempt", async () => {
    const decision = await can({
      tx: learnerAssessmentReadTx(),
      actor: { tenantId: "tenant-a", membershipId: "learner-a" },
      permission: "attempt.read",
      resource: createTenantResourceRef({
        type: "attempt",
        id: "attempt-b",
        tenantId: "tenant-a",
        ownerMembershipId: "learner-b",
        relationships: {},
      }),
      ctx: { tenantId: "tenant-a", requestId: "req_attempt_read_denied" },
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("RELATIONSHIP_REQUIRED");
  });

  it("denies attempt.submit for non-owner", async () => {
    const decision = await can({
      tx: learnerAssessmentReadTx(),
      actor: { tenantId: "tenant-a", membershipId: "learner-a" },
      permission: "attempt.submit",
      resource: createTenantResourceRef({
        type: "attempt",
        id: "attempt-b",
        tenantId: "tenant-a",
        ownerMembershipId: "learner-b",
      }),
      ctx: { tenantId: "tenant-a", requestId: "req_attempt_submit_denied" },
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("OWNERSHIP_REQUIRED");
  });
});
