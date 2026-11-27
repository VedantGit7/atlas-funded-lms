import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { withTenantTx } from "@atlas/db";
import { runProtectedTenantRoutePipeline } from "@atlas/api";
import { getLearnerCourseOutline } from "../../../backend/apps/api/src/server/courses/course-outline.service";
import { learnerCourseOutlineResponseSchema } from "../../../backend/apps/api/src/server/courses/course-outline.schemas";
import { recordLessonProgress } from "../../../backend/apps/api/src/server/lessons/lesson-progress.service";
import { getRouteMetadata } from "../../../backend/apps/api/src/app/api/v1/courses/[id]/outline/route.metadata";
import {
  createLessonEngineFixture,
  instructorCtx,
  learnerCtx,
  lessonTenantTx,
  type LessonEngineFixture,
} from "../../fixtures/lesson-engine-fixture";

/**
 * QA review 1 m41 and review 2 H20: the learner's outline of a course, with
 * their own progress, for the lesson player's sidebar and the course page.
 */
const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

type Ids = {
  videoLessonId: string;
  hiddenLessonId: string;
  draftLessonId: string;
  secondModuleId: string;
  quizLessonId: string;
  draftModuleId: string;
  emptyModuleId: string;
};

/**
 * Adds to the fixture's published course (chapter 1: "Published Lesson", an
 * article): a video lesson, a lesson hidden from the syllabus and a draft
 * lesson in chapter 1; chapter 2 with a quiz lesson; an empty chapter 3; and a
 * draft chapter.
 */
async function addCourseContent(fixture: LessonEngineFixture): Promise<Ids> {
  const ids: Ids = {
    videoLessonId: randomUUID(),
    hiddenLessonId: randomUUID(),
    draftLessonId: randomUUID(),
    secondModuleId: randomUUID(),
    quizLessonId: randomUUID(),
    draftModuleId: randomUUID(),
    emptyModuleId: randomUUID(),
  };
  await withTenantTx(lessonTenantTx(fixture), async (tx) => {
    await tx.$executeRaw`
      insert into course_modules (id, tenant_id, course_id, title, position, status, created_at, updated_at)
      values
        (${ids.secondModuleId}::uuid, ${fixture.tenantId}::uuid, ${fixture.publishedCourseId}::uuid, 'Risk', 2, 'PUBLISHED', now(), now()),
        (${ids.emptyModuleId}::uuid, ${fixture.tenantId}::uuid, ${fixture.publishedCourseId}::uuid, 'Coming soon', 3, 'PUBLISHED', now(), now()),
        (${ids.draftModuleId}::uuid, ${fixture.tenantId}::uuid, ${fixture.publishedCourseId}::uuid, 'Unpublished chapter', 4, 'DRAFT', now(), now())
    `;
    await tx.$executeRaw`
      insert into lessons (id, tenant_id, module_id, slug, title, position, status, content_json, video_url, video_provider, duration_seconds, created_at, updated_at)
      values
        (${ids.videoLessonId}::uuid, ${fixture.tenantId}::uuid, ${fixture.publishedModuleId}::uuid, 'video', 'Reading a chart', 2, 'PUBLISHED', '{}'::jsonb, 'https://www.youtube.com/watch?v=abc', 'youtube', 420, now(), now()),
        (${ids.hiddenLessonId}::uuid, ${fixture.tenantId}::uuid, ${fixture.publishedModuleId}::uuid, 'hidden', 'Hidden extra', 3, 'PUBLISHED', '{"type":"article","body":"x","displayInSyllabus":false}'::jsonb, null, null, null, now(), now()),
        (${ids.draftLessonId}::uuid, ${fixture.tenantId}::uuid, ${fixture.publishedModuleId}::uuid, 'draft', 'Draft secret', 4, 'DRAFT', '{"type":"article","body":"x"}'::jsonb, null, null, null, now(), now()),
        (${ids.quizLessonId}::uuid, ${fixture.tenantId}::uuid, ${ids.secondModuleId}::uuid, 'quiz', 'Check yourself', 1, 'PUBLISHED', '{"type":"section_quiz"}'::jsonb, null, null, null, now(), now())
    `;
  });
  return ids;
}

const asLearner = (fixture: LessonEngineFixture) =>
  withTenantTx(lessonTenantTx(fixture, fixture.learnerMembershipId), (tx) =>
    getLearnerCourseOutline(tx, learnerCtx(fixture), fixture.publishedCourseId),
  );

describeWithDb("learner course outline", () => {
  it("lists published chapters and lessons in order with the learner's progress", async () => {
    const fixture = await createLessonEngineFixture();
    const ids = await addCourseContent(fixture);

    await withTenantTx(lessonTenantTx(fixture, fixture.learnerMembershipId), async (tx) => {
      await recordLessonProgress(tx, learnerCtx(fixture), fixture.publishedLessonId, {
        completed: true,
      });
      await recordLessonProgress(tx, learnerCtx(fixture), ids.videoLessonId, {
        positionSeconds: 0,
        completed: false,
      });
    });

    const outline = learnerCourseOutlineResponseSchema.parse(await asLearner(fixture)).data;

    expect(outline.modules.map((module) => module.title)).toEqual([
      "Published Module",
      "Risk",
      "Coming soon",
    ]);
    expect(outline.modules[0]?.lessons).toEqual([
      {
        id: fixture.publishedLessonId,
        title: "Published Lesson",
        position: 1,
        durationSeconds: 600,
        lessonType: "text",
        status: "completed",
      },
      {
        id: ids.videoLessonId,
        title: "Reading a chart",
        position: 2,
        durationSeconds: 420,
        lessonType: "video",
        status: "in_progress",
      },
    ]);
    expect(outline.modules[1]?.lessons.map((lesson) => [lesson.title, lesson.lessonType])).toEqual([
      ["Check yourself", "section_quiz"],
    ]);
    expect(outline.modules[2]?.lessons).toEqual([]);

    // The hidden lesson isn't listed but still counts, as it does for course
    // completion; the draft lesson and chapter count for nothing.
    expect(JSON.stringify(outline)).not.toContain("Draft secret");
    expect(JSON.stringify(outline)).not.toContain("Unpublished chapter");
    expect(outline.totalLessons).toBe(4);
    expect(outline.completedLessons).toBe(1);
    expect(outline.progressPct).toBe(25);
    expect(outline.resumeLessonId).toBe(ids.videoLessonId);
  });

  it("starts a new learner at the first lesson, with nothing done", async () => {
    const fixture = await createLessonEngineFixture();
    await addCourseContent(fixture);

    const outline = (await asLearner(fixture)).data;

    expect(outline.completedLessons).toBe(0);
    expect(outline.progressPct).toBe(0);
    expect(outline.resumeLessonId).toBe(fixture.publishedLessonId);
    expect(
      outline.modules.flatMap((module) => module.lessons).every((l) => l.status === "not_started"),
    ).toBe(true);
  });

  it("shows each learner only their own progress", async () => {
    const fixture = await createLessonEngineFixture();
    await withTenantTx(lessonTenantTx(fixture, fixture.learnerMembershipId), (tx) =>
      recordLessonProgress(tx, learnerCtx(fixture), fixture.publishedLessonId, {
        completed: true,
      }),
    );
    // Another learner, enrolled in the same course, has done nothing.
    const otherMembershipId = randomUUID();
    const otherPrincipalId = randomUUID();
    await withTenantTx(lessonTenantTx(fixture), async (tx) => {
      await tx.$executeRaw`
        insert into auth_principals (id, email, email_normalized, global_status, created_at, updated_at)
        values (${otherPrincipalId}::uuid, ${`other-${otherPrincipalId.slice(0, 8)}@example.test`},
                ${`other-${otherPrincipalId.slice(0, 8)}@example.test`}, 'active', now(), now())
      `;
      await tx.$executeRaw`
        insert into memberships (id, tenant_id, auth_principal_id, status, joined_at, created_at, updated_at)
        values (${otherMembershipId}::uuid, ${fixture.tenantId}::uuid, ${otherPrincipalId}::uuid, 'ACTIVE', now(), now(), now())
      `;
      await tx.$executeRaw`
        insert into enrollments (id, tenant_id, course_id, membership_id, status, enrolled_at)
        values (${randomUUID()}::uuid, ${fixture.tenantId}::uuid, ${fixture.publishedCourseId}::uuid, ${otherMembershipId}::uuid, 'active', now())
      `;
    });

    const other = await withTenantTx(lessonTenantTx(fixture, otherMembershipId), (tx) =>
      getLearnerCourseOutline(
        tx,
        { tenantId: fixture.tenantId, actorMembershipId: otherMembershipId },
        fixture.publishedCourseId,
      ),
    );
    expect(other.data.completedLessons).toBe(0);
    expect((await asLearner(fixture)).data.completedLessons).toBe(1);
  });

  it("previews the course for someone not enrolled, and refuses a course that isn't published", async () => {
    const fixture = await createLessonEngineFixture();

    // Before enrolling the outline shows what the course covers, with no
    // progress (S3.2, QA review 1 M38).
    const preview = await withTenantTx(
      lessonTenantTx(fixture, fixture.otherInstructorMembershipId),
      (tx) =>
        getLearnerCourseOutline(
          tx,
          { tenantId: fixture.tenantId, actorMembershipId: fixture.otherInstructorMembershipId },
          fixture.publishedCourseId,
        ),
    );
    expect(preview.data.enrolled).toBe(false);
    expect(preview.data.totalLessons).toBe(1);
    expect(preview.data.completedLessons).toBe(0);
    expect(preview.data.modules.flatMap((module) => module.lessons.map((l) => l.status))).toEqual([
      "not_started",
    ]);

    await expect(
      withTenantTx(lessonTenantTx(fixture), (tx) =>
        getLearnerCourseOutline(tx, instructorCtx(fixture), fixture.draftCourseId),
      ),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("lets an enrolled learner through the route's permission check", async () => {
    const fixture = await createLessonEngineFixture();
    const result = await withTenantTx(
      lessonTenantTx(fixture, fixture.learnerMembershipId),
      async (tx) => {
        await runProtectedTenantRoutePipeline({
          tx,
          ctx: {
            tenantId: fixture.tenantId,
            requestId: randomUUID(),
            actorMembershipId: fixture.learnerMembershipId,
          },
          metadata: getRouteMetadata,
          params: { id: fixture.publishedCourseId },
          input: {},
        });
        return getLearnerCourseOutline(tx, learnerCtx(fixture), fixture.publishedCourseId);
      },
    );
    expect(result.data.totalLessons).toBe(1);
  });
});
