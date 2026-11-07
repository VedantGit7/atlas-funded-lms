import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { withTenantTx } from "@atlas/db";
import {
  createCourseModule,
  submitCourseForReview,
} from "../../../backend/apps/api/src/server/courses/course-authoring.service";
import {
  previewCourseUnpublish,
  setLessonVisibility,
  setModuleVisibility,
  unpublishCourse,
} from "../../../backend/apps/api/src/server/courses/course-visibility.service";
import { findCourseAuthProjection } from "../../../backend/apps/api/src/server/courses/courses.repository";
import { getPublishedCourseModules } from "../../../backend/apps/api/src/server/courses/courses.service";
import { createLesson } from "../../../backend/apps/api/src/server/lessons/lessons.service";
import { createLessonBodySchema } from "../../../backend/apps/api/src/server/lessons/lesson-schemas";
import { actOnWorkflowTransition } from "../../../backend/apps/api/src/server/workflows/workflows.service";
import {
  adminCtx,
  authoringTenantTx,
  createCourseAuthoringFixture,
  instructorCtx,
  learnerCtx,
  type CourseAuthoringFixture,
} from "../../fixtures/course-authoring-fixture";

const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

type Built = {
  fixture: CourseAuthoringFixture;
  keptModuleId: string;
  hiddenModuleId: string;
  keptLessonId: string;
  hiddenLessonId: string;
};

function lessonBody(title: string) {
  return createLessonBodySchema.parse({
    title,
    videoProvider: "youtube",
    videoUrl: "https://www.youtube.com/watch?v=aqz-KE-bpKQ",
  });
}

/**
 * A course built through the studio services: one section with two lessons,
 * and a second section. The second section and one lesson are hidden before
 * the course goes for review.
 */
async function buildCourseWithHiddenContent(): Promise<Built> {
  const fixture = await createCourseAuthoringFixture();
  const instructor = instructorCtx(fixture, `req_build_${randomUUID().slice(0, 8)}`);

  return withTenantTx(authoringTenantTx(fixture), async (tx) => {
    const kept = await createCourseModule(tx, instructor, fixture.draftCourseId, {
      title: "Kept Section",
    });
    const hidden = await createCourseModule(tx, instructor, fixture.draftCourseId, {
      title: "Hidden Section",
    });
    const keptLesson = await createLesson(tx, instructor, kept.data.id, lessonBody("Kept Lesson"));
    const hiddenLesson = await createLesson(
      tx,
      instructor,
      kept.data.id,
      lessonBody("Hidden Lesson"),
    );
    await createLesson(tx, instructor, hidden.data.id, lessonBody("Lesson In Hidden Section"));

    const hiddenModule = await setModuleVisibility(tx, instructor, hidden.data.id, {
      visible: false,
    });
    const hiddenLessonResult = await setLessonVisibility(tx, instructor, hiddenLesson.data.id, {
      visible: false,
    });
    expect(hiddenModule.data).toMatchObject({ status: "ARCHIVED", visible: false });
    expect(hiddenLessonResult.data).toMatchObject({ status: "ARCHIVED", visible: false });

    return {
      fixture,
      keptModuleId: kept.data.id,
      hiddenModuleId: hidden.data.id,
      keptLessonId: keptLesson.data.id,
      hiddenLessonId: hiddenLesson.data.id,
    };
  });
}

async function submitAndApprove(fixture: CourseAuthoringFixture) {
  const instructor = instructorCtx(fixture);
  const submitted = await withTenantTx(authoringTenantTx(fixture), async (tx) =>
    submitCourseForReview(tx, instructor, fixture.draftCourseId, { reason: "Ready" }),
  );
  await withTenantTx(authoringTenantTx(fixture, fixture.adminMembershipId), async (tx) =>
    actOnWorkflowTransition(tx, adminCtx(fixture), submitted.data.workflowTransitionId, {
      action: "approve",
      comment: "Approved",
    }),
  );
  return submitted;
}

async function enrollLearner(fixture: CourseAuthoringFixture) {
  await withTenantTx(authoringTenantTx(fixture, fixture.adminMembershipId), async (tx) => {
    await tx.$executeRaw`
      insert into enrollments (id, tenant_id, course_id, membership_id, status, enrolled_at)
      values (${randomUUID()}::uuid, ${fixture.tenantId}::uuid, ${fixture.draftCourseId}::uuid,
              ${fixture.learnerMembershipId}::uuid, 'active', now())
    `;
  });
}

async function learnerModules(fixture: CourseAuthoringFixture) {
  return withTenantTx(authoringTenantTx(fixture, fixture.learnerMembershipId), async (tx) =>
    getPublishedCourseModules(tx, learnerCtx(fixture), fixture.draftCourseId),
  );
}

async function contentStatus(
  fixture: CourseAuthoringFixture,
  table: "course_modules" | "lessons",
  id: string,
) {
  return withTenantTx(authoringTenantTx(fixture, fixture.adminMembershipId), async (tx) => {
    const rows =
      table === "course_modules"
        ? await tx.$queryRaw<Array<{ status: string }>>`
            select status::text from course_modules where id = ${id}::uuid
          `
        : await tx.$queryRaw<Array<{ status: string }>>`
            select status::text from lessons where id = ${id}::uuid
          `;
    return rows[0]?.status;
  });
}

describeWithDb("course content visibility", () => {
  it("keeps hidden sections and lessons hidden when the course is approved", async () => {
    const built = await buildCourseWithHiddenContent();
    await submitAndApprove(built.fixture);

    const view = await learnerModules(built.fixture);
    const titles = view.data.items.map((item) => item.title);
    expect(titles).toContain("Kept Section");
    expect(titles).not.toContain("Hidden Section");
    expect(view.data.items.find((item) => item.title === "Kept Section")?.lessonCount).toBe(1);

    expect(await contentStatus(built.fixture, "course_modules", built.hiddenModuleId)).toBe(
      "ARCHIVED",
    );
    expect(await contentStatus(built.fixture, "lessons", built.hiddenLessonId)).toBe("ARCHIVED");
    expect(await contentStatus(built.fixture, "lessons", built.keptLessonId)).toBe("PUBLISHED");
  });

  it("shows and hides content in a live course straight away, and audits it", async () => {
    const built = await buildCourseWithHiddenContent();
    await submitAndApprove(built.fixture);
    const instructor = instructorCtx(built.fixture, "req_live_visibility");

    await withTenantTx(authoringTenantTx(built.fixture), async (tx) => {
      const shown = await setLessonVisibility(tx, instructor, built.hiddenLessonId, {
        visible: true,
      });
      expect(shown.data).toMatchObject({ status: "PUBLISHED", visible: true });
      const shownModule = await setModuleVisibility(tx, instructor, built.hiddenModuleId, {
        visible: true,
      });
      expect(shownModule.data.status).toBe("PUBLISHED");
      await setModuleVisibility(tx, instructor, built.keptModuleId, { visible: false });
    });

    const view = await learnerModules(built.fixture);
    const titles = view.data.items.map((item) => item.title);
    expect(titles).toEqual(["Hidden Section"]);

    // The lesson shown in the live course published straight away, even though
    // its section is now hidden: showing the section again brings both back.
    await withTenantTx(authoringTenantTx(built.fixture), async (tx) => {
      await setModuleVisibility(tx, instructor, built.keptModuleId, { visible: true });
    });
    const after = await learnerModules(built.fixture);
    expect(after.data.items.find((item) => item.title === "Kept Section")?.lessonCount).toBe(2);

    await withTenantTx(authoringTenantTx(built.fixture), async (tx) => {
      const rows = await tx.$queryRaw<Array<{ action: string }>>`
        select action from audit_entries
        where tenant_id = ${built.fixture.tenantId}::uuid
          and target_id in (${built.hiddenLessonId}, ${built.keptModuleId})
        order by occurred_at asc
      `;
      const actions = rows.map((row) => row.action);
      expect(actions).toContain("lesson.hidden");
      expect(actions).toContain("lesson.shown");
      expect(actions).toContain("course_module.hidden");
      expect(actions).toContain("course_module.shown");
    });
  });

  it("refuses to change visibility while the course is in review", async () => {
    const built = await buildCourseWithHiddenContent();
    const instructor = instructorCtx(built.fixture, "req_review_visibility");

    await withTenantTx(authoringTenantTx(built.fixture), async (tx) => {
      await submitCourseForReview(tx, instructor, built.fixture.draftCourseId, {});
    });

    await expect(
      withTenantTx(authoringTenantTx(built.fixture), async (tx) =>
        setModuleVisibility(tx, instructor, built.hiddenModuleId, { visible: true }),
      ),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      withTenantTx(authoringTenantTx(built.fixture), async (tx) =>
        setLessonVisibility(tx, instructor, built.hiddenLessonId, { visible: true }),
      ),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("shows content in a draft course as draft, for the next approval to publish", async () => {
    const built = await buildCourseWithHiddenContent();
    const instructor = instructorCtx(built.fixture, "req_draft_show");

    const shown = await withTenantTx(authoringTenantTx(built.fixture), async (tx) =>
      setModuleVisibility(tx, instructor, built.hiddenModuleId, { visible: true }),
    );
    expect(shown.data).toMatchObject({ status: "DRAFT", visible: true });

    await submitAndApprove(built.fixture);
    const view = await learnerModules(built.fixture);
    expect(view.data.items.map((item) => item.title)).toContain("Hidden Section");
  });

  it("unpublishes a live course: back to draft, learners lose access, enrollments kept", async () => {
    const built = await buildCourseWithHiddenContent();
    const { fixture } = built;
    await submitAndApprove(fixture);
    await enrollLearner(fixture);
    expect((await learnerModules(fixture)).data.items.length).toBeGreaterThan(0);

    const instructor = instructorCtx(fixture, "req_unpublish_course");
    const preview = await withTenantTx(authoringTenantTx(fixture), async (tx) =>
      previewCourseUnpublish(tx, instructor, fixture.draftCourseId),
    );
    expect(preview.data).toMatchObject({
      status: "PUBLISHED",
      canUnpublish: true,
      activeEnrollments: 1,
    });

    const result = await withTenantTx(authoringTenantTx(fixture), async (tx) =>
      unpublishCourse(tx, instructor, fixture.draftCourseId, { reason: "Fixing a lesson" }),
    );
    expect(result.data).toMatchObject({ status: "DRAFT", activeEnrollments: 1 });

    await withTenantTx(authoringTenantTx(fixture, fixture.adminMembershipId), async (tx) => {
      const course = await findCourseAuthProjection({ tx, courseId: fixture.draftCourseId });
      expect(course?.status).toBe("DRAFT");

      const enrollments = await tx.$queryRaw<Array<{ status: string }>>`
        select status::text from enrollments
        where course_id = ${fixture.draftCourseId}::uuid
          and membership_id = ${fixture.learnerMembershipId}::uuid
      `;
      expect(enrollments.map((row) => row.status)).toEqual(["active"]);

      const audit = await tx.$queryRaw<Array<{ action: string; reason: string | null }>>`
        select action, metadata_json->>'reason' as reason from audit_entries
        where tenant_id = ${fixture.tenantId}::uuid
          and target_id = ${fixture.draftCourseId}
          and action = 'course.unpublished'
      `;
      expect(audit).toHaveLength(1);
      expect(audit[0]?.reason).toBe("Fixing a lesson");

      const events = await tx.$queryRaw<Array<{ event_type: string }>>`
        select event_type from outbox_events
        where tenant_id = ${fixture.tenantId}::uuid
          and aggregate_id = ${fixture.draftCourseId}
          and event_type = 'course.unpublished'
      `;
      expect(events).toHaveLength(1);
    });

    await expect(learnerModules(fixture)).rejects.toBeTruthy();

    // A draft course can't be unpublished again.
    await expect(
      withTenantTx(authoringTenantTx(fixture), async (tx) =>
        unpublishCourse(tx, instructor, fixture.draftCourseId, {}),
      ),
    ).rejects.toMatchObject({ status: 409 });
  });
});
