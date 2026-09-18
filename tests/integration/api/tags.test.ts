import { describe, expect, it } from "vitest";
import { withTenantTx } from "@atlas/db";
import { attachTagToLesson } from "../../../backend/apps/api/src/server/tags/tags.repository";
import { getLessonForEditor } from "../../../backend/apps/api/src/server/lessons/lessons.service";
import {
  createTag,
  createTagAndAttachToLesson,
  listLessonTags,
} from "../../../backend/apps/api/src/server/tags/tags.service";
import {
  createLessonEngineFixture,
  instructorCtx,
  lessonTenantTx,
} from "../../fixtures/lesson-engine-fixture";

const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

describeWithDb("lesson tags integration", () => {
  it("creates a tag catalog entry and attaches it to a lesson", async () => {
    const fixture = await createLessonEngineFixture();

    const result = await withTenantTx(lessonTenantTx(fixture), async (tx) =>
      createTagAndAttachToLesson(
        tx,
        instructorCtx(fixture, "req_tag_create"),
        fixture.draftLessonId,
        {
          title: "Foundations",
          description: "Core concepts",
          visibility: "public",
        },
      ),
    );

    expect(result.tag.title).toBe("Foundations");
    expect(result.lessonTags.data.items.some((tag) => tag.title === "Foundations")).toBe(true);

    const lesson = await withTenantTx(lessonTenantTx(fixture), async (tx) =>
      getLessonForEditor(tx, instructorCtx(fixture), fixture.draftLessonId),
    );

    expect(lesson.data.tags?.some((tag) => tag.title === "Foundations")).toBe(true);
  });

  it("lists private tags in studio but hides them from learner lesson detail paths", async () => {
    const fixture = await createLessonEngineFixture();

    await withTenantTx(lessonTenantTx(fixture), async (tx) => {
      const privateTag = await createTag(tx, instructorCtx(fixture, "req_private_tag"), {
        title: "Internal Review",
        visibility: "private",
      });

      await attachTagToLesson({
        tx,
        tenantId: fixture.tenantId,
        lessonId: fixture.draftLessonId,
        tagId: privateTag.data.id,
      });

      const studioTags = await listLessonTags(tx, instructorCtx(fixture), fixture.draftLessonId, {
        studio: true,
      });
      expect(studioTags.data.items.some((item) => item.title === "Internal Review")).toBe(true);

      const learnerTags = await listLessonTags(tx, instructorCtx(fixture), fixture.draftLessonId);
      expect(learnerTags.data.items.some((item) => item.title === "Internal Review")).toBe(false);
    });
  });
});
