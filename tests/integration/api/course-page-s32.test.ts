import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { withTenantTx } from "@atlas/db";

/**
 * QA remediation S3.2 (review 1 M21, M38, M49, M50; review 2 "course page
 * thin"): course images are really uploaded and served, and the learner's
 * course page gets its instructors, "What you'll learn", FAQs and video, with
 * the rest of Studio's settings kept off the learner page.
 */

// A fake bucket: what was "uploaded".
const bucket = vi.hoisted(() => ({ objects: new Map<string, Buffer>() }));
const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(24),
]);

vi.mock("@atlas/storage/providers/storage-provider-factory", () => ({
  getStorageProvider: () => ({
    createSignedUploadUrl: (input: { key: string }) =>
      Promise.resolve({
        url: `https://acct.r2.cloudflarestorage.com/atlas-assets/${input.key}?upload`,
        method: "PUT",
        requiredHeaders: {},
        expiresAt: new Date(Date.now() + 60_000),
      }),
    createSignedDownloadUrl: (input: { key: string }) =>
      Promise.resolve({
        url: `https://acct.r2.cloudflarestorage.com/atlas-assets/${input.key}?signed`,
        expiresAt: new Date(Date.now() + 60_000),
      }),
    headObject: ({ key }: { key: string }) => {
      const body = bucket.objects.get(key);
      return Promise.resolve(
        body ? { contentType: "image/png", sizeBytes: body.length, checksumSha256: null } : null,
      );
    },
    getObjectBody: ({ key }: { key: string }) => Promise.resolve(bucket.objects.get(key) ?? null),
    putObject: () => Promise.resolve(),
    deleteObject: () => Promise.resolve(),
  }),
}));

import {
  confirmCourseCoverUpload,
  courseCoverPath,
  signCourseCoverDownload,
} from "@atlas/storage/course-cover.service";
import {
  confirmCourseCoverService,
  createCourseCoverUploadService,
} from "../../../backend/apps/api/src/server/courses/course-cover.service";
import { updateCourse } from "../../../backend/apps/api/src/server/courses/course-authoring.service";
import {
  getPublishedCourseDetail,
  listPublishedCourses,
} from "../../../backend/apps/api/src/server/courses/courses.service";
import { courseListQuerySchema } from "../../../backend/apps/api/src/server/courses/schemas";
import {
  createLessonEngineFixture,
  instructorCtx,
  learnerCtx,
  lessonTenantTx,
  type LessonEngineFixture,
} from "../../fixtures/lesson-engine-fixture";

const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

async function courseMetadata(fixture: LessonEngineFixture, courseId: string) {
  const rows = await withTenantTx(
    lessonTenantTx(fixture),
    (tx) =>
      tx.$queryRaw<Array<{ metadata_json: Record<string, unknown> | null }>>`
      select metadata_json from courses where id = ${courseId}::uuid
    `,
  );
  return rows[0]?.metadata_json ?? {};
}

async function startUpload(
  fixture: LessonEngineFixture,
  courseId: string,
  contentType = "image/png",
) {
  return withTenantTx(lessonTenantTx(fixture), (tx) =>
    createCourseCoverUploadService(tx, instructorCtx(fixture), courseId, {
      fileName: "cover.png",
      contentType,
      sizeBytes: PNG.length,
    }),
  );
}

describeWithDb("course images (S3.2, QA review 1 M21, M49)", () => {
  beforeEach(() => {
    bucket.objects.clear();
    delete process.env["R2_PUBLIC_ENDPOINT"];
  });

  it("uploads, confirms and sets the course image, then serves it signed", async () => {
    const fixture = await createLessonEngineFixture();
    const signed = await startUpload(fixture, fixture.draftCourseId);
    bucket.objects.set(signed.data.asset.key, PNG);

    const confirmed = await withTenantTx(lessonTenantTx(fixture), (tx) =>
      confirmCourseCoverService(tx, instructorCtx(fixture), fixture.draftCourseId, {
        assetReferenceId: signed.data.asset.id,
      }),
    );

    expect(confirmed.data.coverKey).toBe(courseCoverPath(signed.data.asset.id));
    const metadata = await courseMetadata(fixture, fixture.draftCourseId);
    expect(metadata["coverKey"]).toBe(courseCoverPath(signed.data.asset.id));
    expect(metadata["coverAssetId"]).toBe(signed.data.asset.id);

    // Anyone in the academy may load the picture; its address signs a download.
    const url = await withTenantTx(lessonTenantTx(fixture, fixture.learnerMembershipId), (tx) =>
      signCourseCoverDownload(tx, signed.data.asset.id),
    );
    expect(url).toBe(
      `https://acct.r2.cloudflarestorage.com/atlas-assets/${signed.data.asset.key}?signed`,
    );
  });

  it("doesn't serve an image that was never confirmed", async () => {
    const fixture = await createLessonEngineFixture();
    const signed = await startUpload(fixture, fixture.draftCourseId);
    bucket.objects.set(signed.data.asset.key, PNG);

    const url = await withTenantTx(lessonTenantTx(fixture), (tx) =>
      signCourseCoverDownload(tx, signed.data.asset.id),
    );
    expect(url).toBeNull();
  });

  it("refuses an upload confirmed against another course", async () => {
    const fixture = await createLessonEngineFixture();
    const signed = await startUpload(fixture, fixture.draftCourseId);
    bucket.objects.set(signed.data.asset.key, PNG);

    await expect(
      withTenantTx(lessonTenantTx(fixture), (tx) =>
        confirmCourseCoverUpload(
          tx,
          { tenantId: fixture.tenantId },
          { assetReferenceId: signed.data.asset.id, courseId: fixture.publishedCourseId },
        ),
      ),
    ).rejects.toThrow("ASSET_REFERENCE_NOT_FOUND");
  });

  it("accepts PNG, JPEG and WebP only, and follows the course's edit lock", async () => {
    const fixture = await createLessonEngineFixture();
    await expect(startUpload(fixture, fixture.draftCourseId, "image/svg+xml")).rejects.toThrow(
      "UNSUPPORTED_COURSE_COVER_TYPE",
    );
    // A published course's settings are locked, the image too.
    await expect(startUpload(fixture, fixture.publishedCourseId)).rejects.toMatchObject({
      status: 409,
    });
  });

  it("removes the image when the course is saved without one", async () => {
    const fixture = await createLessonEngineFixture();
    const signed = await startUpload(fixture, fixture.draftCourseId);
    bucket.objects.set(signed.data.asset.key, PNG);
    await withTenantTx(lessonTenantTx(fixture), (tx) =>
      confirmCourseCoverService(tx, instructorCtx(fixture), fixture.draftCourseId, {
        assetReferenceId: signed.data.asset.id,
      }),
    );

    await withTenantTx(lessonTenantTx(fixture), (tx) =>
      updateCourse(tx, instructorCtx(fixture), fixture.draftCourseId, { coverKey: null }),
    );

    const metadata = await courseMetadata(fixture, fixture.draftCourseId);
    expect(metadata["coverKey"]).toBeNull();
    expect(metadata["coverAssetId"]).toBeNull();
  });
});

describeWithDb("learner course page details (S3.2, QA review 1 M38, M50)", () => {
  async function describeCourse(fixture: LessonEngineFixture) {
    const tags = {
      category: "Price action",
      instructorMembershipIds: [fixture.instructorMembershipId],
      studioBranding: {
        promoVideoUrl: "https://www.youtube.com/watch?v=abc123def45",
        outcomes: ["Read a candlestick chart", "   ", "Place a stop loss"],
      },
      studioFaqs: {
        items: [
          { id: randomUUID(), question: "Is it for beginners?", answer: "Yes.", position: 1 },
          { id: randomUUID(), question: "How long is it?", answer: "Two hours.", position: 0 },
          { id: randomUUID(), question: "", answer: "No question", position: 2 },
        ],
      },
      studioPricingPlans: { plans: [{ id: "internal-plan" }] },
    };
    await withTenantTx(lessonTenantTx(fixture), async (tx) => {
      await tx.$executeRaw`
        update courses
        set metadata_json = ${JSON.stringify({
          shortDescription: "Learn to read the market.",
          level: "beginner",
          tags,
        })}::jsonb
        where id = ${fixture.publishedCourseId}::uuid
      `;
      // The instructor has no profile name, only an account name.
      await tx.$executeRaw`
        update auth_principals set name = 'Asha Rao' where id = ${fixture.instructorPrincipalId}::uuid
      `;
    });
  }

  it("names the instructors and shows what you'll learn, the FAQs and the video", async () => {
    const fixture = await createLessonEngineFixture();
    await describeCourse(fixture);

    const detail = await withTenantTx(lessonTenantTx(fixture, fixture.learnerMembershipId), (tx) =>
      getPublishedCourseDetail(tx, learnerCtx(fixture), fixture.publishedCourseId),
    );

    expect(detail.data).toMatchObject({
      shortDescription: "Learn to read the market.",
      level: "beginner",
      category: "Price action",
      instructors: [{ name: "Asha Rao", avatarUrl: null }],
      outcomes: ["Read a candlestick chart", "Place a stop loss"],
      faqs: [
        { question: "How long is it?", answer: "Two hours." },
        { question: "Is it for beginners?", answer: "Yes." },
      ],
      promoVideoUrl: "https://www.youtube.com/watch?v=abc123def45",
      studentCount: 1,
    });
    // Studio's own settings and member emails stay off the learner page.
    expect(detail.data).not.toHaveProperty("tags");
    expect(JSON.stringify(detail.data)).not.toContain("internal-plan");
    expect(JSON.stringify(detail.data)).not.toContain("@example.test");
  });

  it("falls back to the course's creator when no instructor is set", async () => {
    const fixture = await createLessonEngineFixture();
    await withTenantTx(lessonTenantTx(fixture), async (tx) => {
      await tx.$executeRaw`
        update auth_principals set name = 'Ravi Kumar' where id = ${fixture.instructorPrincipalId}::uuid
      `;
    });

    const detail = await withTenantTx(lessonTenantTx(fixture, fixture.learnerMembershipId), (tx) =>
      getPublishedCourseDetail(tx, learnerCtx(fixture), fixture.publishedCourseId),
    );
    expect(detail.data.instructors).toEqual([{ name: "Ravi Kumar", avatarUrl: null }]);
    expect(detail.data.outcomes).toEqual([]);
    expect(detail.data.faqs).toEqual([]);
    expect(detail.data.promoVideoUrl).toBeNull();
  });

  it("gives catalogue cards the lesson count, the instructor and the category", async () => {
    const fixture = await createLessonEngineFixture();
    await describeCourse(fixture);

    const list = await withTenantTx(lessonTenantTx(fixture, fixture.learnerMembershipId), (tx) =>
      listPublishedCourses(tx, learnerCtx(fixture), courseListQuerySchema.parse({ limit: 100 })),
    );
    const card = list.data.items.find((item) => item.id === fixture.publishedCourseId);

    expect(card).toMatchObject({
      lessonCount: 1,
      category: "Price action",
      instructor: { name: "Asha Rao" },
    });
  });
});
