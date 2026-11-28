import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { withTenantTx, type TenantTx } from "@atlas/db";

/**
 * QA remediation S3.4c against Postgres (review 1 m26): an upload question
 * takes a real file, of the types and size the question allows; the bytes are
 * checked; the learner saves it as the answer; the learner and the grader can
 * open it, and nobody else can.
 */

// A fake bucket: what was "uploaded", with the type it was stored as.
const bucket = vi.hoisted(() => ({
  objects: new Map<string, { body: Buffer; contentType: string }>(),
  types: new Map<string, string>(),
}));
const PDF = Buffer.from("%PDF-1.4\n1 0 obj << >> endobj\ntrailer << >>\n%%EOF\n");

vi.mock("@atlas/storage/providers/storage-provider-factory", () => ({
  getStorageProvider: () => ({
    createSignedUploadUrl: (input: { key: string; contentType: string }) => {
      bucket.types.set(input.key, input.contentType);
      return Promise.resolve({
        url: `https://acct.r2.cloudflarestorage.com/atlas-assets/${input.key}?upload`,
        method: "PUT",
        requiredHeaders: { "content-type": input.contentType },
        expiresAt: new Date(Date.now() + 60_000),
      });
    },
    createSignedDownloadUrl: (input: { key: string }) =>
      Promise.resolve({
        url: `https://acct.r2.cloudflarestorage.com/atlas-assets/${input.key}?signed`,
        expiresAt: new Date(Date.now() + 60_000),
      }),
    headObject: ({ key }: { key: string }) => {
      const object = bucket.objects.get(key);
      return Promise.resolve(
        object
          ? { contentType: object.contentType, sizeBytes: object.body.length, checksumSha256: null }
          : null,
      );
    },
    getObjectBody: ({ key }: { key: string }) =>
      Promise.resolve(bucket.objects.get(key)?.body ?? null),
    putObject: () => Promise.resolve(),
    deleteObject: () => Promise.resolve(),
  }),
}));

import {
  saveAttemptAnswer,
  startAttempt,
  submitAttempt,
} from "../../../backend/apps/api/src/server/attempts/attempts.service";
import {
  confirmAttemptFile,
  createAttemptFileUpload,
  getGradingTaskFile,
  getOwnAttemptFile,
} from "../../../backend/apps/api/src/server/attempts/attempt-files.service";
import {
  authoringTenantTx,
  createItemRegistryFixture,
  instructorCtx,
  learnerCtx,
  otherInstructorCtx,
  type ItemRegistryFixture,
} from "../../fixtures/item-registry-fixture";

const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

/** A published quiz with one upload question: PDF or PNG, up to 1 MB. */
async function uploadQuiz(fixture: ItemRegistryFixture) {
  const itemId = randomUUID();
  const assessmentId = randomUUID();
  await withTenantTx(authoringTenantTx(fixture), async (tx) => {
    await tx.$executeRaw`
      insert into items (id, tenant_id, item_type_key, stem_json, explanation_json, status, tags,
                         created_by_membership_id, created_at, updated_at)
      values (${itemId}::uuid, ${fixture.tenantId}::uuid, 'file_upload',
              ${JSON.stringify({ stem: "Upload your trading plan." })}::jsonb,
              ${JSON.stringify({ answerKey: { acceptedFileTypes: ["pdf", "png"], maxFileSizeMb: 1 } })}::jsonb,
              'PUBLISHED', '{}'::text[], ${fixture.instructorMembershipId}::uuid, now(), now())
    `;
    await tx.$executeRaw`
      insert into assessments (id, tenant_id, slug, title, assessment_type, status, config_json, created_at, updated_at)
      values (${assessmentId}::uuid, ${fixture.tenantId}::uuid, ${`s34c-${assessmentId.slice(0, 8)}`},
              'Plan upload', 'quiz', 'PUBLISHED', ${JSON.stringify({
                createdByMembershipId: fixture.instructorMembershipId,
                attemptsAllowed: 3,
                passMarkPercent: 50,
              })}::jsonb, now(), now())
    `;
    await tx.$executeRaw`
      insert into assessment_items (id, tenant_id, assessment_id, item_id, position, points, config_json, created_at)
      values (${randomUUID()}::uuid, ${fixture.tenantId}::uuid, ${assessmentId}::uuid, ${itemId}::uuid,
              1, 5, '{"required":true}'::jsonb, now())
    `;
  });
  return { itemId, assessmentId };
}

function asLearner<T>(fixture: ItemRegistryFixture, run: (tx: TenantTx) => Promise<T>) {
  return withTenantTx(authoringTenantTx(fixture, fixture.learnerMembershipId), run);
}

describeWithDb("answer files for upload questions (S3.4c)", () => {
  it("takes a real file of an allowed type and size, saves it as the answer and lets the grader open it", async () => {
    const fixture = await createItemRegistryFixture();
    const { itemId, assessmentId } = await uploadQuiz(fixture);
    const learner = learnerCtx(fixture);

    const attemptId = await asLearner(
      fixture,
      async (tx) => (await startAttempt(tx, learner, assessmentId, randomUUID())).data.id,
    );

    // Types and size the question doesn't allow are refused before any upload.
    await expect(
      asLearner(fixture, (tx) =>
        createAttemptFileUpload(tx, learner, attemptId, {
          itemId,
          fileName: "plan.docx",
          sizeBytes: 100,
        }),
      ),
    ).rejects.toThrow("Upload one of these file types: PDF or PNG.");
    await expect(
      asLearner(fixture, (tx) =>
        createAttemptFileUpload(tx, learner, attemptId, {
          itemId,
          fileName: "plan.pdf",
          sizeBytes: 2 * 1024 * 1024,
        }),
      ),
    ).rejects.toThrow("This file is larger than 1 MB. Choose a smaller file.");

    // The type comes from the extension, whatever the browser says.
    const signed = await asLearner(fixture, (tx) =>
      createAttemptFileUpload(tx, learner, attemptId, {
        itemId,
        fileName: "My Plan.PDF",
        sizeBytes: PDF.length,
        contentType: "application/octet-stream",
      }),
    );
    expect(signed.data.asset).toMatchObject({
      purpose: "attempt.answer",
      contentType: "application/pdf",
      visibility: "private",
    });
    expect(signed.data.asset.key).toContain(`/attempts/${attemptId}/`);
    bucket.objects.set(signed.data.asset.key, { body: PDF, contentType: "application/pdf" });

    const confirmed = await asLearner(fixture, (tx) =>
      confirmAttemptFile(tx, learner, attemptId, { assetReferenceId: signed.data.asset.id }),
    );
    expect(confirmed.data).toEqual({
      assetReferenceId: signed.data.asset.id,
      fileName: "My Plan.PDF",
      sizeBytes: PDF.length,
      contentType: "application/pdf",
    });

    // The saved answer comes from the file's record, not from the browser.
    await asLearner(fixture, async (tx) => {
      await saveAttemptAnswer(
        tx,
        learner,
        attemptId,
        {
          itemId,
          answerJson: { assetReferenceId: signed.data.asset.id, fileName: "renamed.exe" },
        },
        randomUUID(),
      );
      await submitAttempt(tx, learner, attemptId, randomUUID());
    });
    const [answer] = await withTenantTx(
      authoringTenantTx(fixture),
      (tx) => tx.$queryRaw<Array<{ answer_json: Record<string, unknown> }>>`
        select answer_json from attempt_answers where attempt_id = ${attemptId}::uuid
      `,
    );
    expect(answer?.answer_json).toEqual(confirmed.data);

    // The learner and the grader can open it.
    const own = await asLearner(fixture, (tx) =>
      getOwnAttemptFile(tx, learner, attemptId, signed.data.asset.id),
    );
    expect(own.data).toMatchObject({ fileName: "My Plan.PDF" });
    expect(own.data.url).toContain("?signed");

    const [task] = await withTenantTx(
      authoringTenantTx(fixture),
      (tx) => tx.$queryRaw<Array<{ id: string }>>`
        select id::text from grading_tasks where attempt_id = ${attemptId}::uuid
      `,
    );
    const graded = await withTenantTx(authoringTenantTx(fixture), (tx) =>
      getGradingTaskFile(tx, instructorCtx(fixture), task?.id ?? "", signed.data.asset.id),
    );
    expect(graded.data.fileName).toBe("My Plan.PDF");

    // Someone else's attempt is not theirs to open.
    await expect(
      withTenantTx(authoringTenantTx(fixture, fixture.otherInstructorMembershipId), (tx) =>
        getOwnAttemptFile(tx, otherInstructorCtx(fixture), attemptId, signed.data.asset.id),
      ),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("refuses a file whose bytes aren't what its name says, and an answer without a confirmed file", async () => {
    const fixture = await createItemRegistryFixture();
    const { itemId, assessmentId } = await uploadQuiz(fixture);
    const learner = learnerCtx(fixture);
    const attemptId = await asLearner(
      fixture,
      async (tx) => (await startAttempt(tx, learner, assessmentId, randomUUID())).data.id,
    );

    const fake = Buffer.from("<html><script>alert(1)</script></html>");
    const signed = await asLearner(fixture, (tx) =>
      createAttemptFileUpload(tx, learner, attemptId, {
        itemId,
        fileName: "plan.pdf",
        sizeBytes: fake.length,
      }),
    );
    bucket.objects.set(signed.data.asset.key, { body: fake, contentType: "application/pdf" });
    await expect(
      asLearner(fixture, (tx) =>
        confirmAttemptFile(tx, learner, attemptId, { assetReferenceId: signed.data.asset.id }),
      ),
    ).rejects.toThrow(/couldn't be checked/);

    // Saving the unconfirmed file, or a typed name, isn't an answer.
    await expect(
      asLearner(fixture, (tx) =>
        saveAttemptAnswer(
          tx,
          learner,
          attemptId,
          { itemId, answerJson: { assetReferenceId: signed.data.asset.id, fileName: "plan.pdf" } },
          randomUUID(),
        ),
      ),
    ).rejects.toThrow("The file wasn't found. Upload it again.");
    await expect(
      asLearner(fixture, (tx) =>
        saveAttemptAnswer(
          tx,
          learner,
          attemptId,
          { itemId, answerJson: { fileName: "plan.pdf" } },
          randomUUID(),
        ),
      ),
    ).rejects.toThrow("The file wasn't found. Upload it again.");
  });
});
