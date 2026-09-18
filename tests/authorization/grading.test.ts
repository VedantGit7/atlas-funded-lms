import { describe, expect, it, vi } from "vitest";
import { can, createTenantResourceRef } from "@atlas/authorization";

function gradingTx(roleKeys: string[]) {
  return {
    $queryRaw: vi
      .fn()
      .mockResolvedValueOnce([{ key: "assessment.grade" }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(
        roleKeys.map((role_key) => ({
          role_key,
          bypasses_resource_predicates: role_key === "owner" || role_key === "admin",
        })),
      ),
  };
}

describe("grading authorization", () => {
  it("denies learner grading queue access", async () => {
    const decision = await can({
      tx: {
        $queryRaw: vi
          .fn()
          .mockResolvedValueOnce([{ key: "assessment.grade" }])
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([]),
      },
      actor: { tenantId: "tenant-a", membershipId: "learner-a" },
      permission: "assessment.grade",
      resource: createTenantResourceRef({
        type: "grading_queue",
        id: "tenant-a",
        tenantId: "tenant-a",
      }),
      ctx: { tenantId: "tenant-a", requestId: "req_auth" },
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("NO_ROLE_GRANT");
  });

  it("allows assigned grader to read grading task", async () => {
    const decision = await can({
      tx: gradingTx(["instructor"]),
      actor: { tenantId: "tenant-a", membershipId: "grader-a" },
      permission: "assessment.grade",
      resource: createTenantResourceRef({
        type: "grading_task",
        id: "task-a",
        tenantId: "tenant-a",
        relationships: { assigneeOfGradingTask: "grader-a" },
      }),
      ctx: { tenantId: "tenant-a", requestId: "req_auth" },
    });

    expect(decision.allowed).toBe(true);
  });

  it("denies instructor grading unassigned task", async () => {
    const decision = await can({
      tx: gradingTx(["instructor"]),
      actor: { tenantId: "tenant-a", membershipId: "grader-a" },
      permission: "assessment.grade",
      resource: createTenantResourceRef({
        type: "grading_task",
        id: "task-a",
        tenantId: "tenant-a",
        relationships: { assigneeOfGradingTask: "grader-b" },
      }),
      ctx: { tenantId: "tenant-a", requestId: "req_auth" },
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("RELATIONSHIP_REQUIRED");
  });

  it("allows assessment author via instructorOfCourse relationship", async () => {
    const decision = await can({
      tx: gradingTx(["instructor"]),
      actor: { tenantId: "tenant-a", membershipId: "author-a" },
      permission: "assessment.grade",
      resource: createTenantResourceRef({
        type: "grading_task",
        id: "task-a",
        tenantId: "tenant-a",
        relationships: { instructorOfCourse: "author-a" },
      }),
      ctx: { tenantId: "tenant-a", requestId: "req_auth" },
    });

    expect(decision.allowed).toBe(true);
  });

  it("allows admin bypass for grading task", async () => {
    const decision = await can({
      tx: gradingTx(["admin"]),
      actor: { tenantId: "tenant-a", membershipId: "admin-a" },
      permission: "assessment.grade",
      resource: createTenantResourceRef({
        type: "grading_task",
        id: "task-a",
        tenantId: "tenant-a",
      }),
      ctx: { tenantId: "tenant-a", requestId: "req_auth" },
    });

    expect(decision.allowed).toBe(true);
    expect(decision.bypassedResourcePredicate).toBe(true);
  });

  it("blocks grading when explicit deny override exists", async () => {
    const decision = await can({
      tx: {
        $queryRaw: vi
          .fn()
          .mockResolvedValueOnce([{ key: "assessment.grade" }])
          .mockResolvedValueOnce([{ effect: "DENY" }])
          .mockResolvedValueOnce([{ role_key: "instructor", bypasses_resource_predicates: false }]),
      },
      actor: { tenantId: "tenant-a", membershipId: "grader-a" },
      permission: "assessment.grade",
      resource: createTenantResourceRef({
        type: "grading_task",
        id: "task-a",
        tenantId: "tenant-a",
        relationships: { assigneeOfGradingTask: "grader-a" },
      }),
      ctx: { tenantId: "tenant-a", requestId: "req_auth" },
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("EXPLICIT_DENY");
  });

  it("denies moderator without grading relationship", async () => {
    const decision = await can({
      tx: gradingTx(["moderator"]),
      actor: { tenantId: "tenant-a", membershipId: "moderator-a" },
      permission: "assessment.grade",
      resource: createTenantResourceRef({
        type: "grading_task",
        id: "task-a",
        tenantId: "tenant-a",
      }),
      ctx: { tenantId: "tenant-a", requestId: "req_auth" },
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("RELATIONSHIP_REQUIRED");
  });
});
