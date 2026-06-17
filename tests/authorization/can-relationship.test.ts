import { describe, expect, it, vi } from "vitest";
import { can, createTenantResourceRef } from "@atlas/authorization";

describe("can relationship predicates", () => {
  it("allows relationship-bound permission when relationship exists", async () => {
    const tx = {
      $queryRaw: vi
        .fn()
        .mockResolvedValueOnce([{ key: "assessment.grade" }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ role_key: "instructor" }]),
    };

    const decision = await can({
      tx,
      actor: { tenantId: "tenant-a", membershipId: "grader-a" },
      permission: "assessment.grade",
      resource: createTenantResourceRef({
        type: "grading_task",
        id: "task-a",
        tenantId: "tenant-a",
        relationships: {
          assigneeOfGradingTask: "grader-a",
        },
      }),
      ctx: { tenantId: "tenant-a", requestId: "req_test" },
    });

    expect(decision.allowed).toBe(true);
  });

  it("denies relationship-bound permission when relationship is missing", async () => {
    const tx = {
      $queryRaw: vi
        .fn()
        .mockResolvedValueOnce([{ key: "assessment.grade" }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ role_key: "instructor" }]),
    };

    const decision = await can({
      tx,
      actor: { tenantId: "tenant-a", membershipId: "grader-a" },
      permission: "assessment.grade",
      resource: createTenantResourceRef({
        type: "grading_task",
        id: "task-a",
        tenantId: "tenant-a",
        relationships: {
          assigneeOfGradingTask: "grader-b",
        },
      }),
      ctx: { tenantId: "tenant-a", requestId: "req_test" },
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("RELATIONSHIP_REQUIRED");
  });
});
