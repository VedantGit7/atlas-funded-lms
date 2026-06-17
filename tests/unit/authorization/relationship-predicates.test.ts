import { describe, expect, it } from "vitest";
import {
  createTenantResourceRef,
  hasRequiredRelationship,
  requiredRelationships,
} from "@atlas/authorization";

describe("relationship predicates", () => {
  it("returns configured relationship keys per permission", () => {
    expect(requiredRelationships("assessment.grade")).toEqual([
      "assigneeOfGradingTask",
      "instructorOfCourse",
    ]);
    expect(requiredRelationships("membership.read")).toEqual([]);
  });

  it("accepts boolean, membership id, or membership id list relationships", () => {
    const resource = createTenantResourceRef({
      type: "grading_task",
      id: "task-a",
      tenantId: "tenant-a",
      relationships: {
        assigneeOfGradingTask: "grader-a",
      },
    });

    expect(
      hasRequiredRelationship({
        actor: { tenantId: "tenant-a", membershipId: "grader-a" },
        resource,
        permission: "assessment.grade",
      }),
    ).toBe(true);

    expect(
      hasRequiredRelationship({
        actor: { tenantId: "tenant-a", membershipId: "grader-b" },
        resource,
        permission: "assessment.grade",
      }),
    ).toBe(false);
  });
});
