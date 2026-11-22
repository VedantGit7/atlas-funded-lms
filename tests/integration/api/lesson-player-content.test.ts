import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { withTenantTx } from "@atlas/db";
import { LocalMockStorageProvider } from "@atlas/storage/providers/local-mock-storage-provider";
import { setStorageProviderForTests } from "@atlas/storage/providers/storage-provider-factory";
import {
  getLessonForEditor,
  getLessonForPlayer,
  updateLesson,
} from "../../../backend/apps/api/src/server/lessons/lessons.service";
import {
  learnerLessonDetailResponseSchema,
  studioLessonDetailResponseSchema,
} from "../../../backend/apps/api/src/server/lessons/lesson-schemas";
import {
  createLessonEngineFixture,
  instructorCtx,
  learnerCtx,
  lessonTenantTx,
  type LessonEngineFixture,
} from "../../fixtures/lesson-engine-fixture";

/**
 * QA review 1 C5/C23/C24 and H11, review 2 C1/C5/C7: what the lesson player
 * receives. Content is typed per lesson type, internal fields stay on the
 * server, the lesson's own file is signed for learners, article text is never
 * wrapped in JSON again, and lesson features reach the learner.
 */
const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

const wrap = (text: string) => JSON.stringify({ body: text });

async function setLesson(
  fixture: LessonEngineFixture,
  lessonId: string,
  contentJson: Record<string, unknown>,
  videoUrl: string | null = null,
) {
  await withTenantTx(
    lessonTenantTx(fixture),
    (tx) =>
      tx.$executeRaw`
      update lessons
         set content_json = ${JSON.stringify(contentJson)}::jsonb,
             video_url = ${videoUrl},
             video_provider = ${videoUrl ? "youtube" : null}
       where id = ${lessonId}::uuid
    `,
  );
}

async function insertReference(
  fixture: LessonEngineFixture,
  args: { resourceId: string; status?: string; fileName?: string; contentType?: string },
) {
  const id = randomUUID();
  await withTenantTx(
    lessonTenantTx(fixture),
    (tx) =>
      tx.$executeRaw`
      insert into storage_references (
        id, tenant_id, bucket, object_key, purpose, resource_type, resource_id,
        file_name, content_type, size_bytes, visibility, status, created_at, updated_at
      ) values (
        ${id}::uuid, ${fixture.tenantId}::uuid, 'test-bucket',
        ${`tenants/${fixture.tenantId}/lessons/${args.resourceId}/${randomUUID()}.pdf`},
        'lesson.asset', 'lesson', ${args.resourceId}::uuid,
        ${args.fileName ?? "notes.pdf"}, ${args.contentType ?? "application/pdf"}, 1024,
        'private', ${args.status ?? "READY"}, now(), now()
      )
    `,
  );
  return id;
}

const asLearner = <T>(fixture: LessonEngineFixture, lessonId: string) =>
  withTenantTx(lessonTenantTx(fixture, fixture.learnerMembershipId), (tx) =>
    getLessonForPlayer(tx, learnerCtx(fixture), lessonId),
  ) as Promise<T>;

const INTERNAL_KEYS = [
  "discussionPostId",
  "primaryAssetReferenceId",
  "thumbnailAssetReferenceId",
  "transcriptAssetReferenceId",
];

describeWithDb("lesson player content", () => {
  const provider = new LocalMockStorageProvider();
  beforeAll(() => setStorageProviderForTests(provider));
  afterAll(() => setStorageProviderForTests(null));

  it("gives learners an article's text, unwrapped, and no internal fields", async () => {
    const fixture = await createLessonEngineFixture();
    await setLesson(fixture, fixture.publishedLessonId, {
      type: "article",
      body: wrap(wrap("Position sizing basics")),
      discussionPostId: randomUUID(),
      primaryAssetReferenceId: randomUUID(),
      features: { allowComments: false, enableDownloads: true, showTranscript: true },
      transcriptText: "Transcript here",
    });

    const result = await asLearner<Awaited<ReturnType<typeof getLessonForPlayer>>>(
      fixture,
      fixture.publishedLessonId,
    );
    const sent = learnerLessonDetailResponseSchema.parse(result);

    expect(sent.data.content).toEqual({ kind: "article", body: "Position sizing basics" });
    const json = JSON.stringify(sent);
    for (const key of INTERNAL_KEYS) expect(json).not.toContain(key);
    // H11: lesson features used to be stripped by the response schema.
    expect(sent.data.features).toEqual({
      allowComments: false,
      enableDownloads: true,
      showTranscript: true,
    });
    expect(sent.data.transcriptText).toBe("Transcript here");
  });

  it("gives learners a quiz's id and a live class's details", async () => {
    const fixture = await createLessonEngineFixture();
    const assessmentId = randomUUID();
    await setLesson(fixture, fixture.publishedLessonId, { type: "section_quiz", assessmentId });
    let sent = learnerLessonDetailResponseSchema.parse(
      await asLearner(fixture, fixture.publishedLessonId),
    );
    // The id names no quiz, so there is no summary card (S1.3 adds one for real quizzes).
    expect(sent.data.content).toEqual({ kind: "quiz", assessmentId, body: null, quiz: null });

    await setLesson(fixture, fixture.publishedLessonId, {
      type: "live",
      live: {
        provider: "zoom",
        meetingUrl: "https://zoom.us/j/9",
        scheduledAt: "2026-12-30T18:00",
      },
    });
    sent = learnerLessonDetailResponseSchema.parse(
      await asLearner(fixture, fixture.publishedLessonId),
    );
    expect(sent.data.content).toEqual({
      kind: "live",
      live: {
        provider: "zoom",
        meetingUrl: "https://zoom.us/j/9",
        scheduledAt: "2026-12-30T18:00",
        instructions: null,
      },
      body: null,
    });
  });

  it("signs the lesson's own ready file for learners", async () => {
    const fixture = await createLessonEngineFixture();
    const referenceId = await insertReference(fixture, { resourceId: fixture.publishedLessonId });
    await setLesson(fixture, fixture.publishedLessonId, {
      type: "pdf",
      primaryAssetReferenceId: referenceId,
      primaryAssetFileName: "notes.pdf",
    });

    const sent = learnerLessonDetailResponseSchema.parse(
      await asLearner(fixture, fixture.publishedLessonId),
    );
    expect(sent.data.content).toMatchObject({
      kind: "file",
      fileType: "pdf",
      file: { name: "notes.pdf", contentType: "application/pdf" },
    });
    const content = sent.data.content;
    expect(content?.kind === "file" && content.file?.url).toBeTruthy();
    expect(JSON.stringify(sent)).not.toContain(referenceId);
  });

  it("does not sign another lesson's file or one that isn't ready", async () => {
    const fixture = await createLessonEngineFixture();
    for (const reference of [
      { resourceId: fixture.draftLessonId },
      { resourceId: fixture.publishedLessonId, status: "PENDING" },
    ]) {
      const referenceId = await insertReference(fixture, reference);
      await setLesson(fixture, fixture.publishedLessonId, {
        type: "pdf",
        primaryAssetReferenceId: referenceId,
      });
      const sent = learnerLessonDetailResponseSchema.parse(
        await asLearner(fixture, fixture.publishedLessonId),
      );
      expect(sent.data.content).toEqual({ kind: "file", fileType: "pdf", file: null, body: null });
    }
  });

  it("gives the Studio preview the same player content", async () => {
    const fixture = await createLessonEngineFixture();
    await setLesson(fixture, fixture.draftLessonId, { type: "article", body: wrap("Draft text") });

    const result = await withTenantTx(lessonTenantTx(fixture), (tx) =>
      getLessonForEditor(tx, instructorCtx(fixture), fixture.draftLessonId),
    );
    const sent = studioLessonDetailResponseSchema.parse(result);
    expect(sent.data.playerContent).toEqual({ kind: "article", body: "Draft text" });
    // The editor gets the text too, not the old JSON wrapping.
    expect(sent.data.content).toEqual({ body: "Draft text" });
  });

  it("unwraps article text saved by an old editor tab", async () => {
    const fixture = await createLessonEngineFixture();
    await withTenantTx(lessonTenantTx(fixture), (tx) =>
      updateLesson(tx, instructorCtx(fixture), fixture.draftLessonId, {
        content: JSON.stringify({ body: "Saved text" }, null, 2),
      }),
    );
    const rows = await withTenantTx(
      lessonTenantTx(fixture),
      (tx) =>
        tx.$queryRaw<Array<{ body: string | null }>>`
        select content_json ->> 'body' as body from lessons where id = ${fixture.draftLessonId}::uuid
      `,
    );
    expect(rows[0]?.body).toBe("Saved text");
  });

  it("migration 134 repairs stored articles and keeps real text", async () => {
    const fixture = await createLessonEngineFixture();
    const sample = '{"symbol":"EURUSD","lots":0.5}';
    await setLesson(fixture, fixture.draftLessonId, {
      type: "article",
      body: wrap(wrap(wrap("Deep text"))),
      isPreview: true,
    });
    await setLesson(fixture, fixture.publishedLessonId, {
      type: "article",
      body: wrap(JSON.stringify({ assessmentId: "x" })),
    });

    const extra = randomUUID();
    const extraJson = { type: "article", body: sample };
    await withTenantTx(
      lessonTenantTx(fixture),
      (tx) =>
        tx.$executeRaw`
        insert into lessons (id, tenant_id, module_id, slug, title, position, status, content_json, created_at, updated_at)
        values (${extra}::uuid, ${fixture.tenantId}::uuid, ${fixture.draftModuleId}::uuid,
                'json-sample', 'JSON sample', 2, 'DRAFT', ${JSON.stringify(extraJson)}::jsonb, now(), now())
      `,
    );

    const owner = new Client({ connectionString: process.env["DATABASE_URL"] });
    await owner.connect();
    try {
      const sql = readFileSync(
        "backend/prisma/migrations/20261121160000_134_repair_wrapped_article_bodies/migration.sql",
        "utf8",
      );
      await owner.query(sql);
      await owner.query(sql); // safe to run twice
    } finally {
      await owner.end();
    }

    const rows = await withTenantTx(
      lessonTenantTx(fixture),
      (tx) =>
        tx.$queryRaw<Array<{ id: string; content_json: Record<string, unknown> }>>`
        select id::text, content_json from lessons
         where id in (${fixture.draftLessonId}::uuid, ${fixture.publishedLessonId}::uuid, ${extra}::uuid)
      `,
    );
    const byId = new Map(rows.map((row) => [row.id, row.content_json]));
    expect(byId.get(fixture.draftLessonId)).toEqual({
      type: "article",
      body: "Deep text",
      isPreview: true,
    });
    expect(byId.get(fixture.publishedLessonId)).toEqual({ type: "article" });
    expect(byId.get(extra)).toEqual(extraJson);
  });
});
