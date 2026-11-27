import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { withTenantTx } from "@atlas/db";
import { listMyCourses } from "../../../backend/apps/api/src/server/enrollments/my-courses.service";
import { myCoursesResponseSchema } from "../../../backend/apps/api/src/server/enrollments/my-courses.schemas";
import { listMyNotifications } from "../../../backend/apps/api/src/server/notifications/notification.service";
import { notificationInboxListQuerySchema } from "../../../backend/apps/api/src/server/notifications/notification.dto";
import {
  createLessonEngineFixture,
  learnerCtx,
  lessonTenantTx,
  type LessonEngineFixture,
} from "../../fixtures/lesson-engine-fixture";

/**
 * QA remediation S3.3 (review 1 M31, M32, M35): the learner home and Progress
 * page read the learner's courses with real progress, named by the course (not
 * the learner), and the home headline is an academy announcement only.
 */

const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

type SecondCourse = { courseId: string; lessonIds: [string, string, string] };

/** A published course with three published lessons and one draft lesson. */
async function addCourse(
  fixture: LessonEngineFixture,
  title: string,
  enroll: { membershipId: string; status?: string } | null,
): Promise<SecondCourse> {
  const courseId = randomUUID();
  const moduleId = randomUUID();
  const lessonIds: [string, string, string] = [randomUUID(), randomUUID(), randomUUID()];
  await withTenantTx(lessonTenantTx(fixture), async (tx) => {
    await tx.$executeRaw`
      insert into courses (id, tenant_id, slug, title, status, metadata_json, created_by_membership_id, created_at, updated_at)
      values (${courseId}::uuid, ${fixture.tenantId}::uuid, ${`s33-${courseId.slice(0, 8)}`}, ${title}, 'PUBLISHED',
        ${JSON.stringify({ coverKey: "/api/v1/public/course-covers/abc", tags: { category: "Risk" } })}::jsonb,
        ${fixture.instructorMembershipId}::uuid, now(), now())
    `;
    await tx.$executeRaw`
      insert into course_modules (id, tenant_id, course_id, title, position, status, created_at, updated_at)
      values (${moduleId}::uuid, ${fixture.tenantId}::uuid, ${courseId}::uuid, 'Basics', 1, 'PUBLISHED', now(), now())
    `;
    for (const [index, lessonId] of lessonIds.entries()) {
      await tx.$executeRaw`
        insert into lessons (id, tenant_id, module_id, slug, title, position, status, content_json, created_at, updated_at)
        values (${lessonId}::uuid, ${fixture.tenantId}::uuid, ${moduleId}::uuid, ${`l-${String(index)}`},
          ${`Lesson ${String(index + 1)}`}, ${index + 1}, 'PUBLISHED', '{}'::jsonb, now(), now())
      `;
    }
    await tx.$executeRaw`
      insert into lessons (id, tenant_id, module_id, slug, title, position, status, content_json, created_at, updated_at)
      values (${randomUUID()}::uuid, ${fixture.tenantId}::uuid, ${moduleId}::uuid, 'draft', 'Draft lesson', 9, 'DRAFT', '{}'::jsonb, now(), now())
    `;
    if (enroll) {
      await tx.$executeRaw`
        insert into enrollments (id, tenant_id, course_id, membership_id, status, enrolled_at)
        values (${randomUUID()}::uuid, ${fixture.tenantId}::uuid, ${courseId}::uuid,
          ${enroll.membershipId}::uuid, ${enroll.status ?? "active"}, now())
      `;
    }
  });
  return { courseId, lessonIds };
}

async function setProgress(
  fixture: LessonEngineFixture,
  lessonId: string,
  status: "in_progress" | "completed",
  minutesAgo: number,
) {
  await withTenantTx(
    lessonTenantTx(fixture),
    (tx) =>
      tx.$executeRaw`
      insert into lesson_progress (id, tenant_id, lesson_id, membership_id, status, progress_pct, last_seen_at, completed_at, updated_at)
      values (${randomUUID()}::uuid, ${fixture.tenantId}::uuid, ${lessonId}::uuid, ${fixture.learnerMembershipId}::uuid,
        ${status}, ${status === "completed" ? 100 : 40},
        now() - make_interval(mins => ${minutesAgo}),
        ${status === "completed" ? new Date(Date.now() - minutesAgo * 60_000) : null}::timestamptz,
        now() - make_interval(mins => ${minutesAgo}))
    `,
  );
}

async function myCourses(fixture: LessonEngineFixture) {
  const result = await withTenantTx(lessonTenantTx(fixture, fixture.learnerMembershipId), (tx) =>
    listMyCourses(tx, learnerCtx(fixture)),
  );
  return myCoursesResponseSchema.parse(result).data;
}

describeWithDb("the learner's courses with progress (S3.3, QA review 1 M31, M32)", () => {
  it("names each course by its title and reads the learner's own progress", async () => {
    const fixture = await createLessonEngineFixture();
    const started = await addCourse(fixture, "Risk management basics", {
      membershipId: fixture.learnerMembershipId,
    });
    await setProgress(fixture, started.lessonIds[0], "completed", 30);
    await setProgress(fixture, started.lessonIds[1], "in_progress", 5);

    const data = await myCourses(fixture);

    // The started course leads, by its title; the untouched fixture course follows.
    expect(data.items.map((item) => item.title)).toEqual([
      "Risk management basics",
      "Published Course",
    ]);
    const first = data.items[0];
    expect(first).toMatchObject({
      courseId: started.courseId,
      status: "in_progress",
      totalLessons: 3, // the draft lesson isn't counted
      completedLessons: 1,
      progressPct: 33,
      nextLesson: { id: started.lessonIds[1], title: "Lesson 2" },
      coverKey: "/api/v1/public/course-covers/abc",
      category: "Risk",
      completedAt: null,
    });
    expect(first?.lessons.map((lesson) => lesson.status)).toEqual([
      "completed",
      "in_progress",
      "not_started",
    ]);
    expect(first?.lastActivityAt).not.toBeNull();
    expect(data.items[1]).toMatchObject({
      courseId: fixture.publishedCourseId,
      status: "not_started",
      nextLesson: { id: fixture.publishedLessonId, title: "Published Lesson" },
      lastActivityAt: null,
    });
    expect(data.totals).toEqual({ enrolled: 2, inProgress: 1, completed: 0, lessonsCompleted: 1 });
  });

  it("lists a finished course last, with no next lesson", async () => {
    const fixture = await createLessonEngineFixture();
    const finished = await addCourse(fixture, "Finished course", {
      membershipId: fixture.learnerMembershipId,
    });
    for (const lessonId of finished.lessonIds) await setProgress(fixture, lessonId, "completed", 1);

    const data = await myCourses(fixture);
    const last = data.items.at(-1);
    expect(last).toMatchObject({
      courseId: finished.courseId,
      status: "completed",
      progressPct: 100,
      nextLesson: null,
    });
    expect(last?.completedAt).not.toBeNull();
    expect(data.totals.completed).toBe(1);
  });

  it("leaves out courses the learner isn't actively enrolled in, and other learners' courses", async () => {
    const fixture = await createLessonEngineFixture();
    await addCourse(fixture, "Cancelled course", {
      membershipId: fixture.learnerMembershipId,
      status: "cancelled",
    });
    await addCourse(fixture, "Not enrolled", null);
    await addCourse(fixture, "Someone else's", { membershipId: fixture.instructorMembershipId });

    const data = await myCourses(fixture);
    expect(data.items.map((item) => item.courseId)).toEqual([fixture.publishedCourseId]);
  });
});

async function addNotice(
  fixture: LessonEngineFixture,
  templateKey: string,
  title: string,
  minutesAgo: number,
) {
  await withTenantTx(
    lessonTenantTx(fixture),
    (tx) =>
      tx.$executeRaw`
      insert into notification_dispatches (id, tenant_id, membership_id, channel, template_key, idempotency_key, status, payload_json, created_at, sent_at)
      values (${randomUUID()}::uuid, ${fixture.tenantId}::uuid, ${fixture.learnerMembershipId}::uuid, 'in_app',
        ${templateKey}, ${randomUUID()}, 'SENT'::"DispatchStatus",
        ${JSON.stringify({ inbox: { title, body: "", actionPath: "/courses", readAt: null } })}::jsonb,
        now() - make_interval(mins => ${minutesAgo}), now() - make_interval(mins => ${minutesAgo}))
    `,
  );
}

describeWithDb("the home page's announcement (S3.3, QA review 1 M35)", () => {
  it("lists academy announcements only when asked, never a private notice", async () => {
    const fixture = await createLessonEngineFixture();
    await addNotice(fixture, "marketing.announcement", "New course out", 60);
    await addNotice(fixture, "security.two_factor_enabled", "Two-factor authentication added", 5);

    const list = (kind?: string) =>
      withTenantTx(lessonTenantTx(fixture, fixture.learnerMembershipId), (tx) =>
        listMyNotifications(
          tx,
          learnerCtx(fixture),
          notificationInboxListQuerySchema.parse({ limit: 5, ...(kind ? { kind } : {}) }),
        ),
      );

    // The inbox still lists everything, newest first.
    expect((await list()).data.map((item) => item.title)).toEqual([
      "Two-factor authentication added",
      "New course out",
    ]);
    expect((await list("announcement")).data.map((item) => item.title)).toEqual(["New course out"]);
  });
});
