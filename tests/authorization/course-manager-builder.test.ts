import { describe, expect, it, vi } from "vitest";
import { can, createTenantResourceRef } from "@atlas/authorization";
import {
  createCourseBodySchema,
  updateCourseBodySchema,
} from "../../backend/apps/api/src/server/courses/course-authoring-schemas";

function instructorTx() {
  return {
    $queryRaw: vi
      .fn()
      .mockResolvedValueOnce([{ key: "course.create" }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ role_key: "instructor" }]),
  };
}

function learnerWithoutCourseCreateTx() {
  return {
    $queryRaw: vi
      .fn()
      .mockResolvedValueOnce([{ key: "course.create" }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]),
  };
}

describe("course manager builder authorization", () => {
  it("allows instructor studio catalog read via instructorOfCourse relationship", async () => {
    const decision = await can({
      tx: instructorTx(),
      actor: { tenantId: "tenant-a", membershipId: "instructor-a" },
      permission: "course.read",
      resource: createTenantResourceRef({
        type: "course_studio_catalog",
        id: "tenant-a",
        tenantId: "tenant-a",
        relationships: { instructorOfCourse: "instructor-a" },
      }),
      ctx: { tenantId: "tenant-a", requestId: "req_auth" },
    });

    expect(decision.allowed).toBe(true);
  });

  it("denies learner course.create without role grant", async () => {
    const decision = await can({
      tx: learnerWithoutCourseCreateTx(),
      actor: { tenantId: "tenant-a", membershipId: "learner-a" },
      permission: "course.create",
      resource: createTenantResourceRef({
        type: "tenant",
        id: "tenant-a",
        tenantId: "tenant-a",
      }),
      ctx: { tenantId: "tenant-a", requestId: "req_auth" },
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("NO_ROLE_GRANT");
  });

  it("denies course.update without instructor relationship", async () => {
    const decision = await can({
      tx: instructorTx(),
      actor: { tenantId: "tenant-a", membershipId: "instructor-a" },
      permission: "course.update",
      resource: createTenantResourceRef({
        type: "course",
        id: "course-b",
        tenantId: "tenant-a",
        ownerMembershipId: "instructor-b",
      }),
      ctx: { tenantId: "tenant-a", requestId: "req_auth" },
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("OWNERSHIP_REQUIRED");
  });

  it("allows instructor course.update on owned course", async () => {
    const decision = await can({
      tx: instructorTx(),
      actor: { tenantId: "tenant-a", membershipId: "instructor-a" },
      permission: "course.update",
      resource: createTenantResourceRef({
        type: "course",
        id: "course-a",
        tenantId: "tenant-a",
        ownerMembershipId: "instructor-a",
        relationships: { instructorOfCourse: "instructor-a" },
      }),
      ctx: { tenantId: "tenant-a", requestId: "req_auth" },
    });

    expect(decision.allowed).toBe(true);
  });

  it("denies course.publish for non-owner instructor", async () => {
    const decision = await can({
      tx: instructorTx(),
      actor: { tenantId: "tenant-a", membershipId: "instructor-a" },
      permission: "course.publish",
      resource: createTenantResourceRef({
        type: "course",
        id: "course-b",
        tenantId: "tenant-a",
        ownerMembershipId: "instructor-b",
        relationships: { instructorOfCourse: "instructor-b" },
      }),
      ctx: { tenantId: "tenant-a", requestId: "req_auth" },
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("OWNERSHIP_REQUIRED");
  });

  it("rejects tenant_id in mutation bodies", () => {
    expect(() =>
      createCourseBodySchema.parse({
        title: "Course",
        tenantId: "018f0000-0000-7000-8000-000000000099",
      }),
    ).toThrow();

    expect(() =>
      updateCourseBodySchema.parse({
        title: "Updated",
        membershipId: "018f0000-0000-7000-8000-000000000099",
      }),
    ).toThrow();
  });
});
