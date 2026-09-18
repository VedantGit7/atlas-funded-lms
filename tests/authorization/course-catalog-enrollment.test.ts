import { describe, expect, it, vi } from "vitest";
import { can, createTenantResourceRef } from "@atlas/authorization";
import { enrollmentCreateBodySchema } from "../../backend/apps/api/src/server/enrollments/schemas";

function learnerTx() {
  return {
    $queryRaw: vi
      .fn()
      .mockResolvedValueOnce([{ key: "course.read" }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ role_key: "learner", bypasses_resource_predicates: false }]),
  };
}

function learnerWithoutEnrollmentCreateTx() {
  return {
    $queryRaw: vi
      .fn()
      .mockResolvedValueOnce([{ key: "enrollment.create" }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]),
  };
}

describe("course catalog enrollment authorization", () => {
  it("allows learner with published catalog relationship to read catalog resource", async () => {
    const decision = await can({
      tx: learnerTx(),
      actor: { tenantId: "tenant-a", membershipId: "member-a" },
      permission: "course.read",
      resource: createTenantResourceRef({
        type: "course_catalog",
        id: "tenant-a",
        tenantId: "tenant-a",
        relationships: { publishedLearnerVisible: true },
      }),
      ctx: { tenantId: "tenant-a", requestId: "req_test" },
    });

    expect(decision.allowed).toBe(true);
  });

  it("allows learner with published course relationship to read course detail", async () => {
    const decision = await can({
      tx: learnerTx(),
      actor: { tenantId: "tenant-a", membershipId: "member-a" },
      permission: "course.read",
      resource: createTenantResourceRef({
        type: "course",
        id: "course-a",
        tenantId: "tenant-a",
        relationships: { publishedLearnerVisible: true },
      }),
      ctx: { tenantId: "tenant-a", requestId: "req_test" },
    });

    expect(decision.allowed).toBe(true);
  });

  it("denies course.read when no published or enrollment relationship exists", async () => {
    const decision = await can({
      tx: learnerTx(),
      actor: { tenantId: "tenant-a", membershipId: "member-a" },
      permission: "course.read",
      resource: createTenantResourceRef({
        type: "course",
        id: "course-a",
        tenantId: "tenant-a",
      }),
      ctx: { tenantId: "tenant-a", requestId: "req_test" },
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("RELATIONSHIP_REQUIRED");
  });

  it("denies enrollment.create without role grant", async () => {
    const decision = await can({
      tx: learnerWithoutEnrollmentCreateTx(),
      actor: { tenantId: "tenant-a", membershipId: "member-a" },
      permission: "enrollment.create",
      resource: createTenantResourceRef({
        type: "course",
        id: "course-a",
        tenantId: "tenant-a",
        relationships: { publishedLearnerVisible: true },
      }),
      ctx: { tenantId: "tenant-a", requestId: "req_test" },
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("NO_ROLE_GRANT");
  });

  it("rejects client membershipId on enrollment body", () => {
    expect(() =>
      enrollmentCreateBodySchema.parse({
        courseId: "018f0000-0000-7000-8000-000000000001",
        membershipId: "018f0000-0000-7000-8000-000000000099",
      }),
    ).toThrow();
  });
});
