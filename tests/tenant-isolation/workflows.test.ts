import { describe, expect, it } from "vitest";
import { withTenantTx } from "@atlas/db";
import { submitCourseForReview } from "../../backend/apps/api/src/server/courses/course-authoring.service";
import { createCourseModule } from "../../backend/apps/api/src/server/courses/course-authoring.service";
import {
  actOnWorkflowTransition,
  listReviewQueue,
} from "../../backend/apps/api/src/server/workflows/workflows.service";
import {
  adminCtx,
  authoringTenantTx,
  createCourseAuthoringFixture,
  instructorCtx,
} from "../fixtures/course-authoring-fixture";
import {
  createTenantIsolationFixture,
  tenantCtx,
} from "../tenant-isolation/tenant-isolation-fixture";

const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

describeWithDb("workflow tenant isolation", () => {
  it("does not list another tenant pending workflow items", async () => {
    const fixtureA = await createCourseAuthoringFixture();
    const fixtureB = await createCourseAuthoringFixture();
    const instructor = instructorCtx(fixtureA, "req_iso_list");

    await withTenantTx(authoringTenantTx(fixtureA), async (tx) => {
      await createCourseModule(tx, instructor, fixtureA.draftCourseId, {
        title: "Tenant A Module",
      });
      await submitCourseForReview(tx, instructor, fixtureA.draftCourseId, {});
    });

    const queue = await withTenantTx(
      authoringTenantTx(fixtureB, fixtureB.adminMembershipId),
      async (tx) =>
        listReviewQueue(tx, adminCtx(fixtureB, "req_iso_list_b"), {
          status: "pending",
          limit: 25,
        }),
    );

    expect(queue.data).toHaveLength(0);
  });

  it("cannot transition another tenant workflow by id", async () => {
    const fixtureA = await createCourseAuthoringFixture();
    const fixtureB = await createCourseAuthoringFixture();
    const instructor = instructorCtx(fixtureA, "req_iso_transition");

    const submitted = await withTenantTx(authoringTenantTx(fixtureA), async (tx) => {
      await createCourseModule(tx, instructor, fixtureA.draftCourseId, { title: "Tenant A Only" });
      return submitCourseForReview(tx, instructor, fixtureA.draftCourseId, {});
    });

    await expect(
      withTenantTx(authoringTenantTx(fixtureB, fixtureB.adminMembershipId), async (tx) =>
        actOnWorkflowTransition(
          tx,
          adminCtx(fixtureB, "req_iso_transition_b"),
          submitted.data.workflowTransitionId,
          { action: "approve" },
        ),
      ),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("blocks cross-tenant workflow listing inside unrelated tenant tx", async () => {
    const isolation = await createTenantIsolationFixture();

    const queue = await withTenantTx(tenantCtx(isolation.tenantB), async (tx) =>
      listReviewQueue(
        tx,
        {
          tenantId: isolation.tenantB.tenantId,
          actorMembershipId: isolation.tenantB.membershipId,
          requestId: "req_iso_rls",
        },
        { status: "pending", limit: 25 },
      ),
    );

    expect(queue).toEqual({
      data: [],
      page: { nextCursor: null, hasMore: false },
    });
  });
});
