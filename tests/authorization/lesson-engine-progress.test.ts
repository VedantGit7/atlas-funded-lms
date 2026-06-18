import { describe, expect, it, vi } from "vitest";
import { can, createTenantResourceRef } from "@atlas/authorization";
import {
  createLessonBodySchema,
  lessonProgressBodySchema,
} from "../../apps/web/src/server/lessons/lesson-schemas";

function learnerTx() {
  return {
    $queryRaw: vi
      .fn()
      .mockResolvedValueOnce([{ key: "course.read" }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ role_key: "learner" }]),
  };
}

function learnerProgressTx() {
  return {
    $queryRaw: vi
      .fn()
      .mockResolvedValueOnce([{ key: "progress.read" }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ role_key: "learner" }]),
  };
}

function instructorWithoutUpdateTx() {
  return {
    $queryRaw: vi
      .fn()
      .mockResolvedValueOnce([{ key: "course.update" }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ role_key: "instructor" }]),
  };
}

describe("lesson engine progress authorization", () => {
  it("allows enrolled learner to read published lesson resource", async () => {
    const decision = await can({
      tx: learnerTx(),
      actor: { tenantId: "tenant-a", membershipId: "learner-a" },
      permission: "course.read",
      resource: createTenantResourceRef({
        type: "course",
        id: "course-a",
        tenantId: "tenant-a",
        relationships: {
          publishedLearnerVisible: true,
          enrolledInCourse: "learner-a",
        },
      }),
      ctx: { tenantId: "tenant-a", requestId: "req_auth" },
    });

    expect(decision.allowed).toBe(true);
  });

  it("denies course.read when no published or enrollment relationship exists", async () => {
    const decision = await can({
      tx: learnerTx(),
      actor: { tenantId: "tenant-a", membershipId: "learner-a" },
      permission: "course.read",
      resource: createTenantResourceRef({
        type: "course",
        id: "course-a",
        tenantId: "tenant-a",
      }),
      ctx: { tenantId: "tenant-a", requestId: "req_auth" },
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("RELATIONSHIP_REQUIRED");
  });

  it("denies course.update without instructor ownership", async () => {
    const decision = await can({
      tx: instructorWithoutUpdateTx(),
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

  it("allows progress.read for self progress relationship", async () => {
    const decision = await can({
      tx: learnerProgressTx(),
      actor: { tenantId: "tenant-a", membershipId: "learner-a" },
      permission: "progress.read",
      resource: createTenantResourceRef({
        type: "course",
        id: "course-a",
        tenantId: "tenant-a",
        relationships: {
          publishedLearnerVisible: true,
          enrolledInCourse: "learner-a",
          selfProgress: "learner-a",
        },
      }),
      ctx: { tenantId: "tenant-a", requestId: "req_auth" },
    });

    expect(decision.allowed).toBe(true);
  });

  it("rejects client membershipId on progress body", () => {
    expect(() =>
      lessonProgressBodySchema.parse({
        completed: true,
        memberId: "018f0000-0000-7000-8000-000000000099",
      }),
    ).toThrow();
  });

  it("rejects client tenant_id on lesson create body", () => {
    expect(() =>
      createLessonBodySchema.parse({
        title: "Lesson",
        tenant_id: "018f0000-0000-7000-8000-000000000001",
      }),
    ).toThrow();
  });
});
