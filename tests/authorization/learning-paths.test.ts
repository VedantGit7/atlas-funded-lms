import { describe, expect, it, vi } from "vitest";
import { can, createTenantResourceRef } from "@atlas/authorization";
import {
  createLearningPathBodySchema,
  updateLearningPathBodySchema,
} from "../../backend/apps/api/src/server/learning-paths/learning-path.schemas";

function instructorTx() {
  return {
    $queryRaw: vi
      .fn()
      .mockResolvedValueOnce([{ key: "learning_path.create" }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ role_key: "instructor" }]),
  };
}

function learnerWithoutCreateTx() {
  return {
    $queryRaw: vi
      .fn()
      .mockResolvedValueOnce([{ key: "learning_path.create" }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]),
  };
}

describe("learning path authorization", () => {
  it("allows learner to read published path catalog", async () => {
    const decision = await can({
      tx: instructorTx(),
      actor: { tenantId: "tenant-a", membershipId: "learner-a" },
      permission: "learning_path.read",
      resource: createTenantResourceRef({
        type: "learning_path_catalog",
        id: "tenant-a",
        tenantId: "tenant-a",
        relationships: { publishedLearnerVisible: true },
      }),
      ctx: { tenantId: "tenant-a", requestId: "req_auth" },
    });

    expect(decision.allowed).toBe(true);
  });

  it("denies learner create without role grant", async () => {
    const decision = await can({
      tx: learnerWithoutCreateTx(),
      actor: { tenantId: "tenant-a", membershipId: "learner-a" },
      permission: "learning_path.create",
      resource: createTenantResourceRef({
        type: "learning_path_studio_catalog",
        id: "tenant-a",
        tenantId: "tenant-a",
        relationships: { instructorOfPath: "learner-a" },
      }),
      ctx: { tenantId: "tenant-a", requestId: "req_auth" },
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("NO_ROLE_GRANT");
  });

  it("denies instructor update on foreign path", async () => {
    const decision = await can({
      tx: instructorTx(),
      actor: { tenantId: "tenant-a", membershipId: "instructor-a" },
      permission: "learning_path.update",
      resource: createTenantResourceRef({
        type: "learning_path",
        id: "path-b",
        tenantId: "tenant-a",
        ownerMembershipId: "instructor-b",
      }),
      ctx: { tenantId: "tenant-a", requestId: "req_auth" },
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("OWNERSHIP_REQUIRED");
  });

  it("allows instructor update on owned path", async () => {
    const decision = await can({
      tx: instructorTx(),
      actor: { tenantId: "tenant-a", membershipId: "instructor-a" },
      permission: "learning_path.update",
      resource: createTenantResourceRef({
        type: "learning_path",
        id: "path-a",
        tenantId: "tenant-a",
        ownerMembershipId: "instructor-a",
        relationships: { instructorOfPath: "instructor-a" },
      }),
      ctx: { tenantId: "tenant-a", requestId: "req_auth" },
    });

    expect(decision.allowed).toBe(true);
  });

  it("denies learner read of draft path without relationship", async () => {
    const decision = await can({
      tx: instructorTx(),
      actor: { tenantId: "tenant-a", membershipId: "learner-a" },
      permission: "learning_path.read",
      resource: createTenantResourceRef({
        type: "learning_path",
        id: "path-a",
        tenantId: "tenant-a",
        ownerMembershipId: "instructor-a",
      }),
      ctx: { tenantId: "tenant-a", requestId: "req_auth" },
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("RELATIONSHIP_REQUIRED");
  });

  it("rejects tenant_id in mutation bodies", () => {
    expect(() =>
      createLearningPathBodySchema.parse({
        title: "Path",
        tenant_id: "018f0000-0000-7000-8000-000000000099",
      }),
    ).toThrow();

    expect(() =>
      updateLearningPathBodySchema.parse({
        title: "Updated",
        membershipId: "018f0000-0000-7000-8000-000000000099",
      }),
    ).toThrow();
  });
});
