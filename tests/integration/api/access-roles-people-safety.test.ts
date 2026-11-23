import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { withTenantTx, type TenantTx } from "@atlas/db";
import { hasStudioAccess, loadMembershipRolesAndStudioAccess } from "@atlas/authorization";
import {
  createCourseDraft,
  listStudioCourses,
  updateCourse,
} from "../../../backend/apps/api/src/server/courses/course-authoring.service";
import { studioCourseListQuerySchema } from "../../../backend/apps/api/src/server/courses/course-authoring-schemas";
import { archiveManageLearner } from "../../../backend/apps/api/src/server/manage/manage-learners.service";
import {
  createManageReview,
  updateManageReview,
} from "../../../backend/apps/api/src/server/manage/manage-reviews.service";
import { getCourseReviews } from "../../../backend/apps/api/src/server/reviews/reviews.service";
import {
  adminCtx,
  authoringTenantTx,
  createCourseAuthoringFixture,
  instructorCtx,
  learnerCtx,
  type CourseAuthoringFixture,
} from "../../fixtures/course-authoring-fixture";

/**
 * QA S1.7 against Postgres (review 1 C17, C20, M12, M18 with owner decision
 * D8 "keep, labelled", m44; review 2 H3, H5).
 */
const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

function asAdmin<T>(fixture: CourseAuthoringFixture, fn: (tx: TenantTx) => Promise<T>) {
  return withTenantTx(authoringTenantTx(fixture, fixture.adminMembershipId), fn);
}

/** Studio access as /me reports it, checked against the standalone rule. */
async function studioAccessOf(fixture: CourseAuthoringFixture, membershipId: string) {
  const [alone, withRoles] = await asAdmin(fixture, (tx) =>
    Promise.all([
      hasStudioAccess({ tx, tenantId: fixture.tenantId, membershipId }),
      loadMembershipRolesAndStudioAccess({ tx, tenantId: fixture.tenantId, membershipId }),
    ]),
  );
  expect(withRoles.studioAccess).toBe(alone);
  expect(withRoles.roles.length).toBeGreaterThan(0);
  return alone;
}

describeWithDb("access, roles and people safety (S1.7)", () => {
  it("opens Studio to staff only, and a DENY override takes it away", async () => {
    const fixture = await createCourseAuthoringFixture();
    expect(await studioAccessOf(fixture, fixture.learnerMembershipId)).toBe(false);
    expect(await studioAccessOf(fixture, fixture.instructorMembershipId)).toBe(true);
    expect(await studioAccessOf(fixture, fixture.adminMembershipId)).toBe(true);

    // A learner given one authoring permission gets Studio.
    await asAdmin(
      fixture,
      (tx) =>
        tx.$executeRaw`
        insert into permission_overrides (id, tenant_id, membership_id, permission_key, effect)
        values (${randomUUID()}::uuid, ${fixture.tenantId}::uuid,
                ${fixture.learnerMembershipId}::uuid, 'item.create', 'ALLOW')
      `,
    );
    expect(await studioAccessOf(fixture, fixture.learnerMembershipId)).toBe(true);

    // An instructor denied every authoring permission loses it.
    await asAdmin(fixture, async (tx) => {
      for (const key of [
        "course.create",
        "course.update",
        "item.create",
        "item.update",
        "assessment.create",
        "assessment.update",
        "assessment.grade",
        "learning_path.create",
        "learning_path.update",
      ]) {
        await tx.$executeRaw`
          insert into permission_overrides (id, tenant_id, membership_id, permission_key, effect)
          values (${randomUUID()}::uuid, ${fixture.tenantId}::uuid,
                  ${fixture.instructorMembershipId}::uuid, ${key}, 'DENY')
        `;
      }
    });
    expect(await studioAccessOf(fixture, fixture.instructorMembershipId)).toBe(false);
  });

  it("refuses the Studio course list to a learner instead of returning an empty list", async () => {
    const fixture = await createCourseAuthoringFixture();
    await expect(
      withTenantTx(authoringTenantTx(fixture, fixture.learnerMembershipId), (tx) =>
        listStudioCourses(
          tx,
          learnerCtx(fixture),
          studioCourseListQuerySchema.parse({ view: "studio" }),
        ),
      ),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("names only staff as course instructors, while a learner listed before can be removed", async () => {
    const fixture = await createCourseAuthoringFixture();
    const instructor = instructorCtx(fixture);

    await expect(
      withTenantTx(authoringTenantTx(fixture), (tx) =>
        createCourseDraft(tx, instructor, {
          title: `Instructors ${randomUUID().slice(0, 6)}`,
          tags: { instructorMembershipIds: [fixture.learnerMembershipId] },
        }),
      ),
    ).rejects.toMatchObject({ status: 400, message: expect.stringMatching(/instructor role/) });

    const created = await withTenantTx(authoringTenantTx(fixture), (tx) =>
      createCourseDraft(tx, instructor, {
        title: `Instructors ${randomUUID().slice(0, 6)}`,
        tags: { instructorMembershipIds: [fixture.instructorMembershipId] },
      }),
    );
    expect(created.data.createdByMembershipId).toBe(fixture.instructorMembershipId);

    // A course saved before this check, with a learner listed: editing it and
    // removing the learner works; adding another learner doesn't.
    await asAdmin(
      fixture,
      (tx) =>
        tx.$executeRaw`
        update courses
        set metadata_json = jsonb_set(coalesce(metadata_json, '{}'::jsonb), '{tags}',
              jsonb_build_object('instructorMembershipIds',
                jsonb_build_array(${fixture.learnerMembershipId}::text)))
        where id = ${fixture.draftCourseId}::uuid
      `,
    );
    await withTenantTx(authoringTenantTx(fixture), (tx) =>
      updateCourse(tx, instructor, fixture.draftCourseId, {
        title: "Renamed with the old learner still listed",
        tags: { instructorMembershipIds: [fixture.learnerMembershipId] },
      }),
    );
    const removed = await withTenantTx(authoringTenantTx(fixture), (tx) =>
      updateCourse(tx, instructor, fixture.draftCourseId, {
        tags: { instructorMembershipIds: [fixture.instructorMembershipId] },
      }),
    );
    expect(removed.data.tags).toMatchObject({
      instructorMembershipIds: [fixture.instructorMembershipId],
    });
  });

  it("won't archive an admin from the learner archive", async () => {
    const fixture = await createCourseAuthoringFixture();
    await expect(
      asAdmin(fixture, (tx) =>
        archiveManageLearner(tx, adminCtx(fixture), fixture.adminMembershipId),
      ),
    ).rejects.toMatchObject({ status: 409, message: expect.stringMatching(/Members page/) });
  });

  describe("academy reviews (D8: keep, labelled)", () => {
    async function publishedCourseWithLearnerReview() {
      const fixture = await createCourseAuthoringFixture();
      await asAdmin(fixture, async (tx) => {
        await tx.$executeRaw`
          update courses set status = 'PUBLISHED' where id = ${fixture.draftCourseId}::uuid
        `;
        await tx.$executeRaw`
          insert into course_reviews (id, tenant_id, course_id, membership_id, rating, comment,
                                      status, created_at, updated_at)
          values (${randomUUID()}::uuid, ${fixture.tenantId}::uuid, ${fixture.draftCourseId}::uuid,
                  ${fixture.learnerMembershipId}::uuid, 2, 'Too fast for beginners', 'APPROVED',
                  now(), now())
        `;
      });
      return fixture;
    }

    function learnerView(fixture: CourseAuthoringFixture) {
      return withTenantTx(authoringTenantTx(fixture, fixture.learnerMembershipId), (tx) =>
        getCourseReviews(tx, learnerCtx(fixture), fixture.draftCourseId, { limit: 20 }),
      );
    }

    it("adds the academy's review without touching the learner's, labelled and outside the average", async () => {
      const fixture = await publishedCourseWithLearnerReview();

      const added = await asAdmin(fixture, (tx) =>
        createManageReview(tx, adminCtx(fixture), {
          courseId: fixture.draftCourseId,
          rating: 5,
          comment: "Our flagship course.",
        }),
      );
      expect(added.data).toMatchObject({
        membershipId: fixture.adminMembershipId,
        addedByAcademy: true,
        rating: 5,
      });

      // Naming a learner to write as is no longer accepted.
      await expect(
        asAdmin(fixture, (tx) =>
          createManageReview(tx, adminCtx(fixture), {
            courseId: fixture.draftCourseId,
            membershipId: fixture.learnerMembershipId,
            rating: 5,
          }),
        ),
      ).rejects.toThrow();

      const view = await learnerView(fixture);
      expect(view.data.aggregate).toEqual({ average: 2, count: 1 });
      const academy = view.data.items.find((item) => item.addedByAcademy);
      expect(academy).toMatchObject({ authorName: null, rating: 5, mine: false });
      const learners = view.data.items.filter((item) => !item.addedByAcademy);
      expect(learners).toEqual([
        expect.objectContaining({ rating: 2, comment: "Too fast for beginners", mine: true }),
      ]);
    });

    it("lets admins moderate a learner's review but not rewrite it", async () => {
      const fixture = await publishedCourseWithLearnerReview();
      const learnerReviewId = (await learnerView(fixture)).data.items[0]?.id ?? "";

      await expect(
        asAdmin(fixture, (tx) =>
          updateManageReview(tx, adminCtx(fixture), learnerReviewId, { rating: 5 }),
        ),
      ).rejects.toMatchObject({ status: 409 });

      const moderated = await asAdmin(fixture, (tx) =>
        updateManageReview(tx, adminCtx(fixture), learnerReviewId, {
          status: "REJECTED",
          adminNote: "Duplicate",
        }),
      );
      expect(moderated.data).toMatchObject({
        status: "REJECTED",
        rating: 2,
        addedByAcademy: false,
      });
    });
  });
});
