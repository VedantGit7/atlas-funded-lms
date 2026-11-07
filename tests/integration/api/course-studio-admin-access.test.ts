import { describe, expect, it } from "vitest";
import { withTenantTx } from "@atlas/db";
import {
  createCourseModule,
  getCourseForBuilder,
  listCourseModulesForBuilderService,
  listStudioCourses,
  updateCourse,
} from "../../../backend/apps/api/src/server/courses/course-authoring.service";
import { loadModuleParentCourseResourceRef } from "../../../backend/apps/api/src/server/courses/load-course-resource-ref";
import { setLessonVisibility } from "../../../backend/apps/api/src/server/courses/course-visibility.service";
import {
  createLesson,
  listLessonsForModule,
} from "../../../backend/apps/api/src/server/lessons/lessons.service";
import { createLessonBodySchema } from "../../../backend/apps/api/src/server/lessons/lesson-schemas";
import {
  adminCtx,
  authoringTenantTx,
  createCourseAuthoringFixture,
  instructorCtx,
  learnerCtx,
  otherInstructorCtx,
  type CourseAuthoringFixture,
} from "../../fixtures/course-authoring-fixture";

const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

/**
 * Staging, 7 November 2026: an admin couldn't open another author's course in
 * the studio ("Course not found or access denied"), so the course editor and
 * settings were reachable only by the course's creator. Admins and owners now
 * manage every course; other instructors and learners still can't.
 */
async function buildCourse(): Promise<{
  fixture: CourseAuthoringFixture;
  moduleId: string;
  lessonId: string;
}> {
  const fixture = await createCourseAuthoringFixture();
  const instructor = instructorCtx(fixture, "req_admin_access_build");
  return withTenantTx(authoringTenantTx(fixture), async (tx) => {
    const module = await createCourseModule(tx, instructor, fixture.draftCourseId, {
      title: "Instructor Section",
    });
    const lesson = await createLesson(
      tx,
      instructor,
      module.data.id,
      createLessonBodySchema.parse({
        title: "Instructor Lesson",
        videoProvider: "youtube",
        videoUrl: "https://www.youtube.com/watch?v=aqz-KE-bpKQ",
      }),
    );
    return { fixture, moduleId: module.data.id, lessonId: lesson.data.id };
  });
}

describeWithDb("course studio access for admins", () => {
  it("lets an admin open, list and edit another author's course", async () => {
    const { fixture, moduleId, lessonId } = await buildCourse();
    const admin = adminCtx(fixture, "req_admin_access");

    await withTenantTx(authoringTenantTx(fixture, fixture.adminMembershipId), async (tx) => {
      const list = await listStudioCourses(tx, admin, {
        view: "studio",
        limit: 25,
        sort: "updated_desc",
      });
      expect(list.data.items.map((item) => item.id)).toContain(fixture.draftCourseId);

      const detail = await getCourseForBuilder(tx, admin, fixture.draftCourseId);
      expect(detail.data.id).toBe(fixture.draftCourseId);

      const modules = await listCourseModulesForBuilderService(tx, admin, fixture.draftCourseId);
      expect(modules.data.items.map((item) => item.id)).toContain(moduleId);

      const lessons = await listLessonsForModule(tx, admin, moduleId, { view: "studio" });
      expect(lessons.data.items.map((item) => item.id)).toContain(lessonId);

      const updated = await updateCourse(tx, admin, fixture.draftCourseId, {
        title: "Renamed By Admin",
      });
      expect(updated.data.title).toBe("Renamed By Admin");

      const loaded = await loadModuleParentCourseResourceRef({ tx, ctx: admin, moduleId });
      expect(loaded.id).toBe(fixture.draftCourseId);

      const hidden = await setLessonVisibility(tx, admin, lessonId, { visible: false });
      expect(hidden.data.status).toBe("ARCHIVED");
    });
  });

  it("still refuses another instructor", async () => {
    const { fixture, moduleId } = await buildCourse();
    const other = otherInstructorCtx(fixture, "req_other_instructor_access");
    const tx = () => authoringTenantTx(fixture, fixture.otherInstructorMembershipId);

    const list = await withTenantTx(tx(), async (inner) =>
      listStudioCourses(inner, other, { view: "studio", limit: 25, sort: "updated_desc" }),
    );
    expect(list.data.items.map((item) => item.id)).not.toContain(fixture.draftCourseId);

    await expect(
      withTenantTx(tx(), async (inner) => getCourseForBuilder(inner, other, fixture.draftCourseId)),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      withTenantTx(tx(), async (inner) =>
        listLessonsForModule(inner, other, moduleId, { view: "studio" }),
      ),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      withTenantTx(tx(), async (inner) =>
        loadModuleParentCourseResourceRef({ tx: inner, ctx: other, moduleId }),
      ),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("still refuses a learner", async () => {
    const { fixture } = await buildCourse();
    const learner = learnerCtx(fixture, "req_learner_studio_access");

    await expect(
      withTenantTx(authoringTenantTx(fixture, fixture.learnerMembershipId), async (tx) =>
        getCourseForBuilder(tx, learner, fixture.draftCourseId),
      ),
    ).rejects.toMatchObject({ status: 404 });
  });
});
