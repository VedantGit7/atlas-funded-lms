import { describe, expect, it } from "vitest";
import { can, createTenantResourceRef } from "@atlas/authorization";
import { authorizationFactsQuery } from "../helpers/authorization-facts";

function instructorTx() {
  return {
    $queryRaw: authorizationFactsQuery(
      [{ key: "enrollment.read" }],
      [],
      [{ role_key: "instructor", bypasses_resource_predicates: false }],
    ),
  };
}

describe("studio roster authorization", () => {
  it("allows instructor enrollment.read via instructorOfCourse relationship", async () => {
    const decision = await can({
      tx: instructorTx(),
      actor: { tenantId: "tenant-a", membershipId: "instructor-a" },
      permission: "enrollment.read",
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

  it("denies enrollment.read without course relationship", async () => {
    const decision = await can({
      tx: instructorTx(),
      actor: { tenantId: "tenant-a", membershipId: "instructor-a" },
      permission: "enrollment.read",
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
    expect(decision.reason).toBe("RELATIONSHIP_REQUIRED");
  });

  it("allows instructor progress.read via instructorOfCourse relationship", async () => {
    const tx = {
      $queryRaw: authorizationFactsQuery(
        [{ key: "progress.read" }],
        [],
        [{ role_key: "instructor", bypasses_resource_predicates: false }],
      ),
    };

    const decision = await can({
      tx,
      actor: { tenantId: "tenant-a", membershipId: "instructor-a" },
      permission: "progress.read",
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
});
