import { describe, expect, it } from "vitest";
import { can, createTenantResourceRef } from "@atlas/authorization";
import { putRouteMetadata as lessonVisibility } from "../../backend/apps/api/src/app/api/v1/lessons/[id]/visibility/route.metadata";
import { putRouteMetadata as moduleVisibility } from "../../backend/apps/api/src/app/api/v1/modules/[id]/visibility/route.metadata";
import {
  getRouteMetadata as unpublishPreview,
  postRouteMetadata as unpublish,
} from "../../backend/apps/api/src/app/api/v1/courses/[id]/unpublish/route.metadata";
import { authorizationFactsQuery } from "../helpers/authorization-facts";

function txWith(roleKey: string, bypassesResourcePredicates: boolean) {
  return {
    $queryRaw: authorizationFactsQuery(
      [{ key: "course.publish" }],
      [],
      [{ role_key: roleKey, bypasses_resource_predicates: bypassesResourcePredicates }],
    ),
  };
}

function courseOwnedBy(ownerMembershipId: string) {
  return createTenantResourceRef({
    type: "course",
    id: "course-a",
    tenantId: "tenant-a",
    ownerMembershipId,
    relationships: { instructorOfCourse: ownerMembershipId },
  });
}

describe("course content visibility authorization", () => {
  it("guards show, hide and unpublish with course.publish, audited and idempotent", () => {
    for (const metadata of [moduleVisibility, lessonVisibility, unpublish]) {
      expect(metadata.permission).toBe("course.publish");
      expect(metadata.audit).toBe("required");
      expect(metadata.idempotency).toBe("required");
      expect(metadata.rateLimit).toBe("tenantMutation");
    }
    expect(unpublishPreview.permission).toBe("course.publish");
    expect(unpublishPreview.audit).toBe("none");
  });

  it("lets the course's instructor act", async () => {
    const decision = await can({
      tx: txWith("instructor", false),
      actor: { tenantId: "tenant-a", membershipId: "instructor-a" },
      permission: "course.publish",
      resource: courseOwnedBy("instructor-a"),
      ctx: { tenantId: "tenant-a", requestId: "req_visibility_owner" },
    });
    expect(decision.allowed).toBe(true);
  });

  it("refuses another instructor", async () => {
    const decision = await can({
      tx: txWith("instructor", false),
      actor: { tenantId: "tenant-a", membershipId: "instructor-b" },
      permission: "course.publish",
      resource: courseOwnedBy("instructor-a"),
      ctx: { tenantId: "tenant-a", requestId: "req_visibility_other" },
    });
    expect(decision.allowed).toBe(false);
  });

  it("lets an admin act on any course in the tenant", async () => {
    const decision = await can({
      tx: txWith("admin", true),
      actor: { tenantId: "tenant-a", membershipId: "admin-a" },
      permission: "course.publish",
      resource: courseOwnedBy("instructor-a"),
      ctx: { tenantId: "tenant-a", requestId: "req_visibility_admin" },
    });
    expect(decision.allowed).toBe(true);
  });

  it("refuses a learner without course.publish", async () => {
    const decision = await can({
      tx: { $queryRaw: authorizationFactsQuery([], [], []) },
      actor: { tenantId: "tenant-a", membershipId: "learner-a" },
      permission: "course.publish",
      resource: courseOwnedBy("instructor-a"),
      ctx: { tenantId: "tenant-a", requestId: "req_visibility_learner" },
    });
    expect(decision.allowed).toBe(false);
  });
});
