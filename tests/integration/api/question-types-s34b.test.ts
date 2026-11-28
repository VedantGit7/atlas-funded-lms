import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { withTenantTx, type TenantTx } from "@atlas/db";
import {
  getAttempt,
  saveAttemptAnswer,
  startAttempt,
  submitAttempt,
} from "../../../backend/apps/api/src/server/attempts/attempts.service";
import { gradeGradingTask } from "../../../backend/apps/api/src/server/grading/grading.service";
import { itemImportService } from "../../../backend/apps/api/src/server/item-registry/item-import.service";
import {
  ITEM_IMPORT_FORMAT,
  ITEM_IMPORT_MIXED,
  ITEM_IMPORT_TEMPLATE_VERSION,
  itemImportColumns,
} from "../../../backend/apps/api/src/server/item-registry/item-import.contract";
import type { ImportTemplateIdentity } from "../../../backend/apps/api/src/server/item-registry/item-import-api.contract";
import {
  authoringTenantTx,
  createItemRegistryFixture,
  instructorCtx,
  learnerCtx,
  type ItemRegistryFixture,
} from "../../fixtures/item-registry-fixture";

/**
 * QA remediation S3.4b against Postgres (review 1 M48, m25; review 2 4.1):
 * a long answer's word limit holds on save, a keyword-marked short answer is
 * marked automatically (also when a person marks the rest), several blanks
 * earn shares of the marks, and a mixed spreadsheet imports each row as its
 * own type.
 */

const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

async function insertItem(
  tx: TenantTx,
  fixture: ItemRegistryFixture,
  type: string,
  stem: string,
  answerKey: Record<string, unknown>,
): Promise<string> {
  const id = randomUUID();
  await tx.$executeRaw`
    insert into items (id, tenant_id, item_type_key, stem_json, explanation_json, status, tags,
                       created_by_membership_id, created_at, updated_at)
    values (${id}::uuid, ${fixture.tenantId}::uuid, ${type}, ${JSON.stringify({ stem })}::jsonb,
            ${JSON.stringify({ answerKey })}::jsonb, 'PUBLISHED', '{}'::text[],
            ${fixture.instructorMembershipId}::uuid, now(), now())
  `;
  return id;
}

/** A published quiz with these questions (2 marks each). */
async function publishedQuiz(fixture: ItemRegistryFixture, itemIds: string[]): Promise<string> {
  const assessmentId = randomUUID();
  await withTenantTx(authoringTenantTx(fixture), async (tx) => {
    await tx.$executeRaw`
      insert into assessments (id, tenant_id, slug, title, assessment_type, status, config_json, created_at, updated_at)
      values (${assessmentId}::uuid, ${fixture.tenantId}::uuid, ${`s34b-${assessmentId.slice(0, 8)}`},
              'Question types quiz', 'quiz', 'PUBLISHED', ${JSON.stringify({
                createdByMembershipId: fixture.instructorMembershipId,
                attemptsAllowed: 5,
                passMarkPercent: 50,
                showAnswersPolicy: "after_submit",
              })}::jsonb, now(), now())
    `;
    for (const [index, itemId] of itemIds.entries()) {
      await tx.$executeRaw`
        insert into assessment_items (id, tenant_id, assessment_id, item_id, position, points, config_json, created_at)
        values (${randomUUID()}::uuid, ${fixture.tenantId}::uuid, ${assessmentId}::uuid, ${itemId}::uuid,
                ${index + 1}, 2, '{"required":true}'::jsonb, now())
      `;
    }
  });
  return assessmentId;
}

function asLearner<T>(fixture: ItemRegistryFixture, run: (tx: TenantTx) => Promise<T>) {
  return withTenantTx(authoringTenantTx(fixture, fixture.learnerMembershipId), run);
}

describeWithDb("question types (S3.4b)", () => {
  it("keeps a long answer within its word limit and tells the learner the limit", async () => {
    const fixture = await createItemRegistryFixture();
    const itemId = await withTenantTx(authoringTenantTx(fixture), (tx) =>
      insertItem(tx, fixture, "long_answer", "Describe your plan.", { maxWords: 5 }),
    );
    const assessmentId = await publishedQuiz(fixture, [itemId]);
    const learner = learnerCtx(fixture);

    await asLearner(fixture, async (tx) => {
      const attempt = await startAttempt(tx, learner, assessmentId, randomUUID());
      const runner = await getAttempt(tx, learner, attempt.data.id);
      expect(runner.data.items[0]?.answerLimits).toEqual({ maxWords: 5 });

      await expect(
        saveAttemptAnswer(
          tx,
          learner,
          attempt.data.id,
          { itemId, answerJson: { value: "one two three four five six" } },
          randomUUID(),
        ),
      ).rejects.toThrow("Keep this answer to 5 words. It has 6.");
      await saveAttemptAnswer(
        tx,
        learner,
        attempt.data.id,
        { itemId, answerJson: { value: "one two three four five" } },
        randomUUID(),
      );
    });
  });

  it("marks a keyword short answer itself, and adds it to a person's marks for the rest", async () => {
    const fixture = await createItemRegistryFixture();
    const { keywordId, longId, blanksId } = await withTenantTx(
      authoringTenantTx(fixture),
      async (tx) => ({
        keywordId: await insertItem(tx, fixture, "short_answer", "What is position sizing?", {
          keywords: ["size", "risk"],
          keywordsRequired: 1,
        }),
        longId: await insertItem(tx, fixture, "long_answer", "Review a losing trade.", {
          rubric: "Mentions the plan.",
        }),
        blanksId: await insertItem(tx, fixture, "fill_blank", "A ____ then a ____.", {
          blanks: [{ acceptedValues: ["hammer"] }, { acceptedValues: ["breakout"] }],
        }),
      }),
    );
    const assessmentId = await publishedQuiz(fixture, [keywordId, longId, blanksId]);
    const learner = learnerCtx(fixture);

    const attemptId = await asLearner(fixture, async (tx) => {
      const attempt = await startAttempt(tx, learner, assessmentId, randomUUID());
      const save = (itemId: string, answerJson: Record<string, unknown>) =>
        saveAttemptAnswer(tx, learner, attempt.data.id, { itemId, answerJson }, randomUUID());
      await save(keywordId, { value: "Choose the size of the trade." });
      await save(longId, { value: "I compared it with my plan." });
      await save(blanksId, { values: ["Hammer", "fakeout"] });
      const submitted = await submitAttempt(tx, learner, attempt.data.id, randomUUID());
      // The long answer still needs a person.
      expect(submitted.data).toMatchObject({ status: "SUBMITTED", requiresManualGrading: true });
      return attempt.data.id;
    });

    const answers = await withTenantTx(
      authoringTenantTx(fixture),
      (tx) =>
        tx.$queryRaw<Array<{ item_id: string; is_correct: boolean | null; points: number }>>`
        select ai.item_id::text, aa.is_correct, aa.points_awarded::float as points
        from attempt_answers aa
        inner join assessment_items ai on ai.id = aa.assessment_item_id
        where aa.attempt_id = ${attemptId}::uuid
      `,
    );
    const byItem = new Map(answers.map((row) => [row.item_id, row]));
    expect(byItem.get(keywordId)).toMatchObject({ is_correct: true, points: 2 });
    expect(byItem.get(blanksId)).toMatchObject({ is_correct: false, points: 1 });

    const [task] = await withTenantTx(
      authoringTenantTx(fixture),
      (tx) => tx.$queryRaw<Array<{ id: string }>>`
        select id::text from grading_tasks where attempt_id = ${attemptId}::uuid
      `,
    );
    // The person marks only the long answer (2 marks); the 3 automatic marks are kept.
    const graded = await withTenantTx(authoringTenantTx(fixture), (tx) =>
      gradeGradingTask(
        tx,
        { ...instructorCtx(fixture), idempotencyKey: `grade-${randomUUID()}` },
        task?.id ?? "",
        { score: 2, feedback: "Good." },
      ),
    );
    expect(JSON.stringify(graded)).toContain('"scorePercent":83.3333');
  });

  it("imports a mixed spreadsheet, each row as its own type", async () => {
    const fixture = await createItemRegistryFixture();
    const columns = itemImportColumns(ITEM_IMPORT_MIXED, []);
    const template: ImportTemplateIdentity = {
      format: ITEM_IMPORT_FORMAT,
      version: ITEM_IMPORT_TEMPLATE_VERSION,
      itemTypeKey: ITEM_IMPORT_MIXED,
      columns: columns.map((column) => column.key),
      headers: columns.map((column) => (column.required ? `${column.header} *` : column.header)),
    };
    const rows = [
      {
        rowNumber: 2,
        cells: {
          question_type: "True / False",
          question: "Stops cap losses.",
          correct_answer: "TRUE",
        },
      },
      {
        rowNumber: 3,
        cells: {
          question_type: "Fill in the blank",
          question: "A ____ then a ____.",
          blank_1: "hammer",
          blank_2: "breakout; break out",
        },
      },
      {
        rowNumber: 4,
        cells: { question_type: "Short answer", question: "Define risk.", keywords: "loss" },
      },
    ];
    const ctx = instructorCtx(fixture);

    const checked = await withTenantTx(authoringTenantTx(fixture), (tx) =>
      itemImportService.checkRows(tx, ctx, { template, rows }),
    );
    expect(checked.data.rows.map((row) => row.status)).toEqual(["ready", "ready", "ready"]);

    const batch = await withTenantTx(authoringTenantTx(fixture), (tx) =>
      itemImportService.createBatch(tx, ctx, {
        template,
        fileName: "mixed.xlsx",
        rowsInFile: 3,
        rowsWithErrors: 0,
        rowsToImport: 3,
        skipDuplicates: true,
        extraTags: [],
      }),
    );
    const imported = await withTenantTx(authoringTenantTx(fixture), (tx) =>
      itemImportService.importRows(tx, ctx, batch.data.id, { template, rows }),
    );
    expect(imported.data.results.map((result) => result.outcome)).toEqual([
      "imported",
      "imported",
      "imported",
    ]);

    const types = await withTenantTx(
      authoringTenantTx(fixture),
      (tx) => tx.$queryRaw<Array<{ item_type_key: string; answer_key: unknown }>>`
        select item_type_key, explanation_json->'answerKey' as answer_key
        from items where import_batch_id = ${batch.data.id}::uuid
        order by import_row_number
      `,
    );
    expect(types.map((row) => row.item_type_key)).toEqual([
      "true_false",
      "fill_blank",
      "short_answer",
    ]);
    expect(types[1]?.answer_key).toEqual({
      blanks: [{ acceptedValues: ["hammer"] }, { acceptedValues: ["breakout", "break out"] }],
    });

    // The same text in another type isn't a repeat; in the same type it is.
    const again = await withTenantTx(authoringTenantTx(fixture), (tx) =>
      itemImportService.checkRows(tx, ctx, {
        template,
        rows: [
          { rowNumber: 2, cells: { question_type: "Long answer", question: "Define risk." } },
          { rowNumber: 3, cells: { question_type: "Short answer", question: "Define risk." } },
        ],
      }),
    );
    expect(again.data.rows.map((row) => row.status)).toEqual(["ready", "duplicate"]);
  });
});
