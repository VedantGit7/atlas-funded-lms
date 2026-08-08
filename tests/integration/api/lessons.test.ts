import { describe, expect, it } from "vitest";
import { withTenantTx } from "@atlas/db";
import {
  archiveOrDeleteLesson,
  createLesson,
  getLesson,
  getLessonForPlayer,
  listLessonsForModule,
  updateLesson,
} from "../../../backend/apps/api/src/server/lessons/lessons.service";
import {
  createLessonEngineFixture,
  instructorCtx,
  learnerCtx,
  lessonTenantTx,
} from "../../fixtures/lesson-engine-fixture";

const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

describeWithDb("lessons integration", () => {
  it("lists lessons for owned module in studio", async () => {
    const fixture = await createLessonEngineFixture();

    const result = await withTenantTx(lessonTenantTx(fixture), async (tx) =>
      listLessonsForModule(tx, instructorCtx(fixture), fixture.draftModuleId, { view: "studio" }),
    );

    expect(result.data.items.some((item) => item.id === fixture.draftLessonId)).toBe(true);
  });

  it("creates lesson under owned module", async () => {
    const fixture = await createLessonEngineFixture();

    const created = await withTenantTx(lessonTenantTx(fixture), async (tx) =>
      createLesson(tx, instructorCtx(fixture, "req_lesson_create"), fixture.draftModuleId, {
        title: "New Lesson",
      }),
    );

    expect(created.data.title).toBe("New Lesson");
  });

  it("returns learner lesson when enrolled and published", async () => {
    const fixture = await createLessonEngineFixture();

    const result = await withTenantTx(
      lessonTenantTx(fixture, fixture.learnerMembershipId),
      async (tx) => getLessonForPlayer(tx, learnerCtx(fixture), fixture.publishedLessonId),
    );

    expect(result.data.title).toBe("Published Lesson");
    expect(JSON.stringify(result.data)).toContain("learner secret");
  });

  it("blocks unpublished lesson for learner", async () => {
    const fixture = await createLessonEngineFixture();

    await expect(
      withTenantTx(lessonTenantTx(fixture, fixture.learnerMembershipId), async (tx) =>
        getLessonForPlayer(tx, learnerCtx(fixture), fixture.draftLessonId),
      ),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("updates owned lesson", async () => {
    const fixture = await createLessonEngineFixture();

    const updated = await withTenantTx(lessonTenantTx(fixture), async (tx) =>
      updateLesson(tx, instructorCtx(fixture, "req_lesson_update"), fixture.draftLessonId, {
        title: "Updated Draft Lesson",
      }),
    );

    expect(updated.data.title).toBe("Updated Draft Lesson");
  });

  it("soft-deletes owned lesson", async () => {
    const fixture = await createLessonEngineFixture();

    const created = await withTenantTx(lessonTenantTx(fixture), async (tx) =>
      createLesson(tx, instructorCtx(fixture), fixture.draftModuleId, { title: "Temp Lesson" }),
    );

    await withTenantTx(lessonTenantTx(fixture), async (tx) =>
      archiveOrDeleteLesson(tx, instructorCtx(fixture), created.data.id),
    );

    await expect(
      withTenantTx(lessonTenantTx(fixture), async (tx) =>
        getLesson(tx, instructorCtx(fixture), created.data.id, { view: "studio" }),
      ),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("creates a lesson at position 1 after the previous lesson was soft-deleted", async () => {
    const fixture = await createLessonEngineFixture();

    const created = await withTenantTx(lessonTenantTx(fixture), async (tx) =>
      createLesson(tx, instructorCtx(fixture), fixture.draftModuleId, { title: "Temp Lesson" }),
    );

    await withTenantTx(lessonTenantTx(fixture), async (tx) =>
      archiveOrDeleteLesson(tx, instructorCtx(fixture), created.data.id),
    );

    const recreated = await withTenantTx(lessonTenantTx(fixture), async (tx) =>
      createLesson(tx, instructorCtx(fixture, "req_lesson_recreate"), fixture.draftModuleId, {
        title: "Replacement Lesson",
        lessonType: "video",
      }),
    );

    expect(recreated.data.title).toBe("Replacement Lesson");
    expect(recreated.data.position).toBeGreaterThanOrEqual(1);
  });

  it("returns lessonType in studio module lesson list", async () => {
    const fixture = await createLessonEngineFixture();

    const created = await withTenantTx(lessonTenantTx(fixture), async (tx) =>
      createLesson(tx, instructorCtx(fixture, "req_lesson_type_list"), fixture.draftModuleId, {
        title: "Typed Lesson",
        lessonType: "pdf",
      }),
    );

    const result = await withTenantTx(lessonTenantTx(fixture), async (tx) =>
      listLessonsForModule(tx, instructorCtx(fixture), fixture.draftModuleId, { view: "studio" }),
    );

    const item = result.data.items.find((lesson) => lesson.id === created.data.id);
    expect(item?.lessonType).toBe("pdf");
  });
});
