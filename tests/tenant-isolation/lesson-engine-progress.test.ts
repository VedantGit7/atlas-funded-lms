import { describe, expect, it } from "vitest";
import { withTenantTx } from "@atlas/db";
import {
  attachLessonAsset,
  listLessonAssetsForLesson,
} from "../../backend/apps/api/src/server/lessons/lesson-assets.service";
import {
  archiveOrDeleteLesson,
  createLesson,
  getLessonForPlayer,
  listLessonsForModule,
  updateLesson,
} from "../../backend/apps/api/src/server/lessons/lessons.service";
import { recordLessonProgress } from "../../backend/apps/api/src/server/lessons/lesson-progress.service";
import { lessonProgressBodySchema } from "../../backend/apps/api/src/server/lessons/lesson-schemas";
import {
  createLessonEngineFixture,
  instructorCtx,
  learnerCtx,
  lessonTenantTx,
} from "../fixtures/lesson-engine-fixture";
import { createTenantIsolationFixture, tenantCtx } from "./tenant-isolation-fixture";

const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

describeWithDb("lesson engine tenant isolation", () => {
  it("Tenant A cannot read Tenant B lesson", async () => {
    const fixture = await createLessonEngineFixture();
    const isolation = await createTenantIsolationFixture();

    await expect(
      withTenantTx(tenantCtx(isolation.tenantB), async (tx) =>
        getLessonForPlayer(
          tx,
          {
            tenantId: isolation.tenantB.tenantId,
            actorMembershipId: isolation.tenantB.membershipId,
            requestId: "req_iso_lesson_read",
          },
          fixture.publishedLessonId,
        ),
      ),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("Tenant A cannot update Tenant B lesson", async () => {
    const fixture = await createLessonEngineFixture();
    const isolation = await createTenantIsolationFixture();

    await expect(
      withTenantTx(tenantCtx(isolation.tenantB), async (tx) =>
        updateLesson(
          tx,
          {
            tenantId: isolation.tenantB.tenantId,
            actorMembershipId: isolation.tenantB.membershipId,
            requestId: "req_iso_lesson_update",
          },
          fixture.draftLessonId,
          { title: "Hacked" },
        ),
      ),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("Tenant A cannot delete Tenant B lesson", async () => {
    const fixture = await createLessonEngineFixture();
    const isolation = await createTenantIsolationFixture();

    await expect(
      withTenantTx(tenantCtx(isolation.tenantB), async (tx) =>
        archiveOrDeleteLesson(
          tx,
          {
            tenantId: isolation.tenantB.tenantId,
            actorMembershipId: isolation.tenantB.membershipId,
            requestId: "req_iso_lesson_delete",
          },
          fixture.draftLessonId,
        ),
      ),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("Tenant A cannot list lessons for Tenant B module", async () => {
    const fixture = await createLessonEngineFixture();
    const isolation = await createTenantIsolationFixture();

    await expect(
      withTenantTx(tenantCtx(isolation.tenantB), async (tx) =>
        listLessonsForModule(
          tx,
          {
            tenantId: isolation.tenantB.tenantId,
            actorMembershipId: isolation.tenantB.membershipId,
            requestId: "req_iso_module_lessons",
          },
          fixture.draftModuleId,
          { view: "studio" },
        ),
      ),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("Tenant A cannot read Tenant B lesson assets", async () => {
    const fixture = await createLessonEngineFixture();
    const isolation = await createTenantIsolationFixture();

    await expect(
      withTenantTx(tenantCtx(isolation.tenantB), async (tx) =>
        listLessonAssetsForLesson(
          tx,
          {
            tenantId: isolation.tenantB.tenantId,
            actorMembershipId: isolation.tenantB.membershipId,
            requestId: "req_iso_assets",
          },
          fixture.publishedLessonId,
        ),
      ),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("Tenant A cannot attach Tenant B lesson assets", async () => {
    const fixture = await createLessonEngineFixture();
    const isolation = await createTenantIsolationFixture();

    await expect(
      withTenantTx(tenantCtx(isolation.tenantB), async (tx) =>
        attachLessonAsset(
          tx,
          {
            tenantId: isolation.tenantB.tenantId,
            actorMembershipId: isolation.tenantB.membershipId,
            requestId: "req_iso_asset_attach",
          },
          fixture.draftLessonId,
          {
            assetType: "link",
            provider: "external",
            objectKeyOrUrl: "https://example.com/x.pdf",
          },
        ),
      ),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("Tenant A cannot write progress for Tenant B lesson", async () => {
    const fixture = await createLessonEngineFixture();
    const isolation = await createTenantIsolationFixture();

    await expect(
      withTenantTx(tenantCtx(isolation.tenantB), async (tx) =>
        recordLessonProgress(
          tx,
          {
            tenantId: isolation.tenantB.tenantId,
            actorMembershipId: isolation.tenantB.membershipId,
            requestId: "req_iso_progress",
          },
          fixture.publishedLessonId,
          { completed: true },
        ),
      ),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("rejects client tenant_id in progress body schema", () => {
    expect(() =>
      lessonProgressBodySchema.parse({
        completed: true,
        tenantId: "018f0000-0000-7000-8000-000000000099",
      }),
    ).toThrow();
  });

  it("learner cannot access lesson without enrollment", async () => {
    const fixture = await createLessonEngineFixture();
    const unenrolledLearnerId = fixture.otherInstructorMembershipId;

    await expect(
      withTenantTx(lessonTenantTx(fixture, unenrolledLearnerId), async (tx) =>
        getLessonForPlayer(
          tx,
          {
            tenantId: fixture.tenantId,
            actorMembershipId: unenrolledLearnerId,
            requestId: "req_unenrolled",
          },
          fixture.publishedLessonId,
        ),
      ),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("instructor cannot edit another instructor lesson", async () => {
    const fixture = await createLessonEngineFixture();

    await expect(
      withTenantTx(lessonTenantTx(fixture, fixture.otherInstructorMembershipId), async (tx) =>
        updateLesson(
          tx,
          {
            tenantId: fixture.tenantId,
            actorMembershipId: fixture.otherInstructorMembershipId,
            requestId: "req_other_instructor",
          },
          fixture.draftLessonId,
          { title: "Not allowed" },
        ),
      ),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("instructor can create lesson in own module", async () => {
    const fixture = await createLessonEngineFixture();

    const created = await withTenantTx(lessonTenantTx(fixture), async (tx) =>
      createLesson(tx, instructorCtx(fixture), fixture.draftModuleId, {
        title: "Owned lesson",
      }),
    );

    expect(created.data.title).toBe("Owned lesson");
  });

  it("enrolled learner can read published lesson", async () => {
    const fixture = await createLessonEngineFixture();

    const lesson = await withTenantTx(
      lessonTenantTx(fixture, fixture.learnerMembershipId),
      async (tx) => getLessonForPlayer(tx, learnerCtx(fixture), fixture.publishedLessonId),
    );

    expect(lesson.data.id).toBe(fixture.publishedLessonId);
  });
});
