import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { withTenantTx, type TenantTx } from "@atlas/db";
import {
  createCourseModule,
  submitCourseForReview,
} from "../../../backend/apps/api/src/server/courses/course-authoring.service";
import {
  setLessonVisibility,
  setModuleVisibility,
  unpublishCourse,
} from "../../../backend/apps/api/src/server/courses/course-visibility.service";
import { getPublishedCourseModules } from "../../../backend/apps/api/src/server/courses/courses.service";
import {
  loadCourseResourceRef,
  loadLessonParentCourseResourceRef,
} from "../../../backend/apps/api/src/server/courses/load-course-resource-ref";
import {
  archiveOrDeleteLesson,
  createLesson,
  getLessonForEditor,
  getLessonForPlayer,
  updateLesson,
} from "../../../backend/apps/api/src/server/lessons/lessons.service";
import {
  createLessonBodySchema,
  updateLessonBodySchema,
} from "../../../backend/apps/api/src/server/lessons/lesson-schemas";
import { restoreContentTrash } from "../../../backend/apps/api/src/server/content-trash/content-trash.service";
import { actOnWorkflowTransition } from "../../../backend/apps/api/src/server/workflows/workflows.service";
import {
  addSectionWithLesson,
  adminCtx,
  authoringTenantTx,
  createCourseAuthoringFixture,
  instructorCtx,
  learnerCtx,
  type CourseAuthoringFixture,
} from "../../fixtures/course-authoring-fixture";

/**
 * QA S1.6 against Postgres (review 1 C27, C28, M22; review 2 C2, C3, H10,
 * H28): a live course gets new sections and lessons as drafts and publishes
 * them one by one while its learners keep access; published lessons can be
 * edited; an empty course can't be submitted; an unpublished course tells its
 * learners it's being updated.
 */
const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

function videoLesson(title: string) {
  return createLessonBodySchema.parse({
    title,
    videoProvider: "youtube",
    videoUrl: "https://www.youtube.com/watch?v=aqz-KE-bpKQ",
  });
}

type LiveCourse = {
  fixture: CourseAuthoringFixture;
  sectionId: string;
  lessonId: string;
};

/** A course with one section and lesson, approved, and one enrolled learner. */
async function liveCourseWithLearner(): Promise<LiveCourse> {
  const fixture = await createCourseAuthoringFixture();
  const instructor = instructorCtx(fixture);
  const { sectionId, lessonId, transitionId } = await withTenantTx(
    authoringTenantTx(fixture),
    async (tx) => {
      const built = await addSectionWithLesson(tx, instructor, fixture.draftCourseId, "Basics");
      const submitted = await submitCourseForReview(tx, instructor, fixture.draftCourseId, {});
      return { ...built, transitionId: submitted.data.workflowTransitionId };
    },
  );
  await withTenantTx(authoringTenantTx(fixture, fixture.adminMembershipId), async (tx) => {
    await actOnWorkflowTransition(tx, adminCtx(fixture), transitionId, { action: "approve" });
    await tx.$executeRaw`
      insert into enrollments (id, tenant_id, course_id, membership_id, status, enrolled_at)
      values (${randomUUID()}::uuid, ${fixture.tenantId}::uuid, ${fixture.draftCourseId}::uuid,
              ${fixture.learnerMembershipId}::uuid, 'active', now())
    `;
  });
  return { fixture, sectionId, lessonId };
}

function asInstructor<T>(fixture: CourseAuthoringFixture, fn: (tx: TenantTx) => Promise<T>) {
  return withTenantTx(authoringTenantTx(fixture), fn);
}

function asLearner<T>(fixture: CourseAuthoringFixture, fn: (tx: TenantTx) => Promise<T>) {
  return withTenantTx(authoringTenantTx(fixture, fixture.learnerMembershipId), fn);
}

async function learnerOutline(fixture: CourseAuthoringFixture) {
  const modules = await asLearner(fixture, (tx) =>
    getPublishedCourseModules(tx, learnerCtx(fixture), fixture.draftCourseId),
  );
  return modules.data.items.map((item) => ({ title: item.title, lessons: item.lessonCount }));
}

async function learnerOpens(fixture: CourseAuthoringFixture, lessonId: string) {
  return asLearner(fixture, (tx) => getLessonForPlayer(tx, learnerCtx(fixture), lessonId));
}

describeWithDb("editing a live course (S1.6)", () => {
  it("adds a draft section and lesson, then publishes them, while learners keep access", async () => {
    const { fixture, lessonId } = await liveCourseWithLearner();
    const instructor = instructorCtx(fixture);

    const added = await asInstructor(fixture, async (tx) => {
      const section = await createCourseModule(tx, instructor, fixture.draftCourseId, {
        title: "Advanced",
      });
      const lesson = await createLesson(tx, instructor, section.data.id, videoLesson("Breakouts"));
      return { sectionId: section.data.id, lessonId: lesson.data.id };
    });

    // Drafts: learners don't see them, and still have the live lesson.
    expect(await learnerOutline(fixture)).toEqual([{ title: "Basics", lessons: 1 }]);
    expect((await learnerOpens(fixture, lessonId)).data.id).toBe(lessonId);
    await expect(learnerOpens(fixture, added.lessonId)).rejects.toMatchObject({ status: 404 });

    // The lesson alone is published, but its section is still a draft: it
    // doesn't open from a direct link.
    const lessonPublished = await asInstructor(fixture, (tx) =>
      setLessonVisibility(tx, instructor, added.lessonId, { visible: true }),
    );
    expect(lessonPublished.data.status).toBe("PUBLISHED");
    await expect(learnerOpens(fixture, added.lessonId)).rejects.toMatchObject({ status: 404 });

    // Publishing the section brings it and its lessons to learners.
    const sectionPublished = await asInstructor(fixture, (tx) =>
      setModuleVisibility(tx, instructor, added.sectionId, { visible: true }),
    );
    expect(sectionPublished.data).toMatchObject({ status: "PUBLISHED", visible: true });
    expect(await learnerOutline(fixture)).toEqual([
      { title: "Basics", lessons: 1 },
      { title: "Advanced", lessons: 1 },
    ]);
    expect((await learnerOpens(fixture, added.lessonId)).data.title).toBe("Breakouts");
  });

  it("publishes a new section with all its draft lessons, leaving hidden ones hidden", async () => {
    const { fixture } = await liveCourseWithLearner();
    const instructor = instructorCtx(fixture);

    const result = await asInstructor(fixture, async (tx) => {
      const section = await createCourseModule(tx, instructor, fixture.draftCourseId, {
        title: "Psychology",
      });
      await createLesson(tx, instructor, section.data.id, videoLesson("Fear"));
      await createLesson(tx, instructor, section.data.id, videoLesson("Greed"));
      const hidden = await createLesson(tx, instructor, section.data.id, videoLesson("Notes"));
      await setLessonVisibility(tx, instructor, hidden.data.id, { visible: false });
      return setModuleVisibility(tx, instructor, section.data.id, { visible: true });
    });

    expect(result.data.lessonsPublished).toBe(2);
    expect(await learnerOutline(fixture)).toContainEqual({ title: "Psychology", lessons: 2 });
  });

  it("edits a published lesson in place: learners see the change at once", async () => {
    const { fixture, lessonId } = await liveCourseWithLearner();
    const instructor = instructorCtx(fixture);

    const edited = await asInstructor(fixture, (tx) =>
      updateLesson(
        tx,
        instructor,
        lessonId,
        updateLessonBodySchema.parse({ title: "Basics, fixed" }),
      ),
    );
    expect(edited.data).toMatchObject({
      title: "Basics, fixed",
      status: "PUBLISHED",
      moduleStatus: "PUBLISHED",
      courseStatus: "PUBLISHED",
    });
    expect((await learnerOpens(fixture, lessonId)).data.title).toBe("Basics, fixed");
  });

  it("moves a live lesson to Trash and restores it", async () => {
    const { fixture, sectionId, lessonId } = await liveCourseWithLearner();
    const instructor = instructorCtx(fixture);

    await asInstructor(fixture, (tx) => archiveOrDeleteLesson(tx, instructor, lessonId));
    expect(await learnerOutline(fixture)).toEqual([{ title: "Basics", lessons: 0 }]);

    await withTenantTx(authoringTenantTx(fixture, fixture.adminMembershipId), (tx) =>
      restoreContentTrash(tx, adminCtx(fixture), { kind: "lessons", id: lessonId }),
    );
    // It comes back at a valid position in its (now empty) section.
    const restored = await asInstructor(fixture, (tx) =>
      getLessonForEditor(tx, instructor, lessonId),
    );
    expect(restored.data).toMatchObject({ moduleId: sectionId, position: 1 });
    expect(await learnerOutline(fixture)).toEqual([{ title: "Basics", lessons: 1 }]);
  });

  it("locks content while the course is in review", async () => {
    const fixture = await createCourseAuthoringFixture();
    const instructor = instructorCtx(fixture);
    const { sectionId } = await asInstructor(fixture, async (tx) => {
      const built = await addSectionWithLesson(tx, instructor, fixture.draftCourseId);
      await submitCourseForReview(tx, instructor, fixture.draftCourseId, {});
      return built;
    });

    await expect(
      asInstructor(fixture, (tx) =>
        createLesson(tx, instructor, sectionId, videoLesson("During review")),
      ),
    ).rejects.toMatchObject({ status: 409, message: expect.stringMatching(/in review/) });
  });

  it("refuses to submit a course with nothing for learners", async () => {
    const fixture = await createCourseAuthoringFixture();
    const instructor = instructorCtx(fixture);

    await expect(
      asInstructor(fixture, async (tx) => {
        await createCourseModule(tx, instructor, fixture.draftCourseId, { title: "Empty" });
        return submitCourseForReview(tx, instructor, fixture.draftCourseId, {});
      }),
    ).rejects.toMatchObject({ status: 400, message: expect.stringMatching(/at least one lesson/) });

    // Hidden lessons don't count.
    await expect(
      asInstructor(fixture, async (tx) => {
        const { lessonId } = await addSectionWithLesson(tx, instructor, fixture.draftCourseId);
        await setLessonVisibility(tx, instructor, lessonId, { visible: false });
        return submitCourseForReview(tx, instructor, fixture.draftCourseId, {});
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("unpublishing returns content to draft and tells enrolled learners it's being updated", async () => {
    const { fixture, lessonId } = await liveCourseWithLearner();
    const instructor = instructorCtx(fixture);

    await asInstructor(fixture, (tx) =>
      unpublishCourse(tx, instructor, fixture.draftCourseId, { reason: "Re-recording" }),
    );

    const lesson = await asInstructor(fixture, (tx) =>
      getLessonForEditor(tx, instructor, lessonId),
    );
    expect(lesson.data).toMatchObject({
      status: "DRAFT",
      moduleStatus: "DRAFT",
      courseStatus: "DRAFT",
    });

    // The enrolled learner is told it's being updated, on the course and on a lesson link.
    const learner = { tenantId: fixture.tenantId, actorMembershipId: fixture.learnerMembershipId };
    await expect(
      asLearner(fixture, (tx) =>
        loadCourseResourceRef({ tx, ctx: learner, courseId: fixture.draftCourseId }),
      ),
    ).rejects.toMatchObject({ status: 409, code: "COURSE_BEING_UPDATED" });
    await expect(
      asLearner(fixture, (tx) => loadLessonParentCourseResourceRef({ tx, ctx: learner, lessonId })),
    ).rejects.toMatchObject({ status: 409, code: "COURSE_BEING_UPDATED" });

    // Someone not enrolled still gets "not found".
    const stranger = { tenantId: fixture.tenantId, actorMembershipId: fixture.adminMembershipId };
    await expect(
      withTenantTx(authoringTenantTx(fixture, fixture.adminMembershipId), (tx) =>
        loadCourseResourceRef({ tx, ctx: stranger, courseId: fixture.draftCourseId }),
      ),
    ).rejects.toMatchObject({ status: 404 });

    // Approving it again brings the content back.
    const submitted = await asInstructor(fixture, (tx) =>
      submitCourseForReview(tx, instructor, fixture.draftCourseId, {}),
    );
    await withTenantTx(authoringTenantTx(fixture, fixture.adminMembershipId), (tx) =>
      actOnWorkflowTransition(tx, adminCtx(fixture), submitted.data.workflowTransitionId, {
        action: "approve",
      }),
    );
    expect((await learnerOpens(fixture, lessonId)).data.id).toBe(lessonId);
  });
});
