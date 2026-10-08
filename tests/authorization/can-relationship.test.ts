import { describe, expect, it } from "vitest";
import { can, createTenantResourceRef } from "@atlas/authorization";
import { authorizationFactsQuery } from "../helpers/authorization-facts";

describe("can relationship predicates", () => {
  it("allows relationship-bound permission when relationship exists", async () => {
    const tx = {
      $queryRaw: authorizationFactsQuery(
        [{ key: "assessment.grade" }],
        [],
        [{ role_key: "instructor", bypasses_resource_predicates: false }],
      ),
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
      $queryRaw: authorizationFactsQuery(
        [{ key: "assessment.grade" }],
        [],
        [{ role_key: "instructor", bypasses_resource_predicates: false }],
      ),
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
