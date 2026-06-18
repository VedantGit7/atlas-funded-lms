import { describe, expect, it } from "vitest";
import { withTenantTx } from "@atlas/db";
import {
  attachLessonAsset,
  listLessonAssetsForLesson,
  removeLessonAsset,
} from "../../../apps/web/src/server/lessons/lesson-assets.service";
import {
  createLessonEngineFixture,
  instructorCtx,
  learnerCtx,
  lessonTenantTx,
} from "../../fixtures/lesson-engine-fixture";

const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

describeWithDb("lesson assets integration", () => {
  it("attaches and lists external asset reference", async () => {
    const fixture = await createLessonEngineFixture();

    const attached = await withTenantTx(lessonTenantTx(fixture), async (tx) =>
      attachLessonAsset(tx, instructorCtx(fixture, "req_asset_attach"), fixture.draftLessonId, {
        assetType: "link",
        provider: "external",
        objectKeyOrUrl: "https://example.com/handout.pdf",
        displayOrder: 1,
      }),
    );

    expect(attached.data.externalUrl).toBe("https://example.com/handout.pdf");

    const listed = await withTenantTx(lessonTenantTx(fixture), async (tx) =>
      listLessonAssetsForLesson(tx, instructorCtx(fixture), fixture.draftLessonId, {
        view: "studio",
      }),
    );

    expect(listed.data.items.some((item) => item.id === attached.data.id)).toBe(true);
  });

  it("returns learner-safe asset projection for published lesson", async () => {
    const fixture = await createLessonEngineFixture();

    const listed = await withTenantTx(
      lessonTenantTx(fixture, fixture.learnerMembershipId),
      async (tx) => listLessonAssetsForLesson(tx, learnerCtx(fixture), fixture.publishedLessonId),
    );

    expect(listed.data.items).toHaveLength(1);
    expect(listed.data.items[0]?.externalUrl).toBe("https://example.com/published-resource.pdf");
  });

  it("removes asset reference", async () => {
    const fixture = await createLessonEngineFixture();

    const attached = await withTenantTx(lessonTenantTx(fixture), async (tx) =>
      attachLessonAsset(tx, instructorCtx(fixture), fixture.draftLessonId, {
        assetType: "link",
        provider: "external",
        objectKeyOrUrl: "https://example.com/remove-me.pdf",
      }),
    );

    await withTenantTx(lessonTenantTx(fixture), async (tx) =>
      removeLessonAsset(tx, instructorCtx(fixture), fixture.draftLessonId, attached.data.id),
    );

    const listed = await withTenantTx(lessonTenantTx(fixture), async (tx) =>
      listLessonAssetsForLesson(tx, instructorCtx(fixture), fixture.draftLessonId, {
        view: "studio",
      }),
    );

    expect(listed.data.items.some((item) => item.id === attached.data.id)).toBe(false);
  });
});
