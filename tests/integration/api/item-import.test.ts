import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { DEFAULT_TENANT_TX_TIMEOUT_MS, withTenantTx } from "@atlas/db";
import {
  ITEM_IMPORT_TEMPLATE_VERSION,
  ITEM_IMPORT_FORMAT,
  itemImportColumns,
  type ImportDimension,
} from "../../../backend/apps/api/src/server/item-registry/item-import.contract";
import {
  ITEM_IMPORT_CHUNK_MAX_ROWS,
  type ImportRowPayload,
  type ImportTemplateIdentity,
} from "../../../backend/apps/api/src/server/item-registry/item-import-api.contract";
import type { ValidatedItemTypeKey } from "../../../backend/apps/api/src/server/item-registry/item-definition.contract";
import { itemImportService } from "../../../backend/apps/api/src/server/item-registry/item-import.service";
import { itemRegistryService } from "../../../backend/apps/api/src/server/item-registry/item-registry.service";
import {
  authoringTenantTx,
  createItemRegistryFixture,
  instructorCtx,
  otherInstructorCtx,
  type ItemRegistryFixture,
} from "../../fixtures/item-registry-fixture";

const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

function identity(
  type: ValidatedItemTypeKey,
  dimensions: ImportDimension[] = [],
  overrides: Partial<ImportTemplateIdentity> = {},
): ImportTemplateIdentity {
  const columns = itemImportColumns(type, dimensions);
  return {
    format: ITEM_IMPORT_FORMAT,
    version: ITEM_IMPORT_TEMPLATE_VERSION,
    itemTypeKey: type,
    columns: columns.map((column) => column.key),
    headers: columns.map((column) => (column.required ? `${column.header} *` : column.header)),
    ...overrides,
  };
}

function mcqRow(rowNumber: number, question: string, extra: ImportRowPayload["cells"] = {}) {
  return {
    rowNumber,
    cells: {
      question,
      option_a: "Hammer",
      option_b: "Shooting star",
      correct_option: "A",
      ...extra,
    },
  };
}

async function addDimension(fixture: ItemRegistryFixture): Promise<ImportDimension> {
  const id = randomUUID();
  const name = `Risk ${id.slice(0, 6)}`;
  await withTenantTx(authoringTenantTx(fixture), async (tx) => {
    await tx.$executeRaw`
      insert into competency_dimensions (id, tenant_id, key, name, created_at, updated_at)
      values (${id}::uuid, ${fixture.tenantId}::uuid, ${`risk-${id.slice(0, 6)}`}, ${name}, now(), now())
    `;
  });
  return { id, name };
}

async function inTx<T>(fixture: ItemRegistryFixture, run: Parameters<typeof withTenantTx>[1]) {
  return withTenantTx(authoringTenantTx(fixture), run) as Promise<T>;
}

async function openBatch(
  fixture: ItemRegistryFixture,
  options: { rowsToImport: number; skipDuplicates?: boolean; extraTags?: string[] },
  type: ValidatedItemTypeKey = "mcq_single",
  dimensions: ImportDimension[] = [],
) {
  return inTx<Awaited<ReturnType<typeof itemImportService.createBatch>>>(fixture, (tx) =>
    itemImportService.createBatch(tx, instructorCtx(fixture), {
      template: identity(type, dimensions),
      fileName: "questions.xlsx",
      rowsInFile: options.rowsToImport + 1,
      rowsWithErrors: 1,
      rowsToImport: options.rowsToImport,
      skipDuplicates: options.skipDuplicates ?? true,
      extraTags: options.extraTags ?? [],
    }),
  );
}

describeWithDb("item import", () => {
  describe("check", () => {
    it("marks rows ready, invalid or already in the bank, without writing", async () => {
      const fixture = await createItemRegistryFixture();
      const existing = await inTx<{ data: { id: string } }>(fixture, (tx) =>
        itemRegistryService.createItem(tx, instructorCtx(fixture), {
          itemTypeKey: "mcq_single",
          contentJson: { stem: "Which candle is a bullish reversal?" },
          answerKeyJson: {},
          options: [
            { optionJson: { label: "Hammer" }, isCorrect: true, position: 1 },
            { optionJson: { label: "Doji" }, isCorrect: false, position: 2 },
          ],
          tags: [],
        }),
      );

      const result = await inTx<Awaited<ReturnType<typeof itemImportService.checkRows>>>(
        fixture,
        (tx) =>
          itemImportService.checkRows(tx, instructorCtx(fixture), {
            template: identity("mcq_single"),
            rows: [
              mcqRow(2, "What does a long upper wick show?"),
              mcqRow(3, "  WHICH candle   is a bullish reversal?  "),
              mcqRow(4, "No answer here", { correct_option: "E" }),
              mcqRow(5, "what does a LONG upper wick show?"),
            ],
          }),
      );

      const [ready, repeat, invalid, sameAsRowTwo] = result.data.rows;
      expect(ready).toMatchObject({ rowNumber: 2, status: "ready", duplicateOf: null });
      expect(repeat).toMatchObject({
        rowNumber: 3,
        status: "duplicate",
        duplicateOf: { itemId: existing.data.id, reason: "question" },
      });
      expect(invalid?.status).toBe("invalid");
      expect(invalid?.issues.map((issue) => issue.message)).toContain(
        "The correct option is E, but Option E is empty.",
      );
      // Repeats within the file are found by the browser from fingerprints.
      expect(sameAsRowTwo?.status).toBe("ready");
      expect(sameAsRowTwo?.fingerprint).toBe(ready?.fingerprint);
      expect(repeat?.fingerprint).not.toBe(ready?.fingerprint);

      const batches = await inTx<Array<{ count: bigint }>>(
        fixture,
        (tx) => tx.$queryRaw`select count(*) as count from item_import_batches`,
      );
      expect(Number(batches[0]?.count)).toBe(0);
    });

    it("refuses an outdated template or one with moved columns", async () => {
      const fixture = await createItemRegistryFixture();
      const check = (template: ImportTemplateIdentity) =>
        inTx(fixture, (tx) =>
          itemImportService.checkRows(tx, instructorCtx(fixture), {
            template,
            rows: [mcqRow(2, "Question")],
          }),
        );

      await expect(check(identity("mcq_single", [], { version: "0" }))).rejects.toThrow(
        /version 0, and the current version is 2/,
      );
      const moved = identity("mcq_single");
      moved.headers = [moved.headers[1] ?? "", moved.headers[0] ?? "", ...moved.headers.slice(2)];
      await expect(check(moved)).rejects.toThrow(
        /Column A of the Questions sheet should be "Question"/,
      );
      await expect(
        check(identity("mcq_single", [{ id: randomUUID(), name: "Gone" }])),
      ).rejects.toThrow(/dimension that no longer exists/);
    });
  });

  describe("import", () => {
    it("creates Draft questions with their answers, weights, tags and source row", async () => {
      const fixture = await createItemRegistryFixture();
      const dimension = await addDimension(fixture);
      const dimensions = [dimension];
      const batch = await openBatch(
        fixture,
        { rowsToImport: 2, extraTags: ["imported", "Candles"] },
        "mcq_multi",
        dimensions,
      );
      expect(batch.data).toMatchObject({ status: "importing", importedCount: 0 });

      const result = await inTx<Awaited<ReturnType<typeof itemImportService.importRows>>>(
        fixture,
        (tx) =>
          itemImportService.importRows(tx, instructorCtx(fixture), batch.data.id, {
            template: identity("mcq_multi", dimensions),
            rows: [
              {
                rowNumber: 2,
                cells: {
                  question: "Which candles are bullish reversals?",
                  option_a: "Hammer",
                  option_b: "Bullish engulfing",
                  option_c: "Shooting star",
                  correct_options: "A, B",
                  explanation: "Both close near their highs.",
                  tags: "candles, basics",
                  reference: "Q-001",
                  [`weight:${dimension.id}`]: 0.5,
                },
              },
              {
                rowNumber: 3,
                cells: { question: "Broken", option_a: "Only one", correct_options: "A" },
              },
            ],
          }),
      );

      expect(result.data.results.map((row) => row.outcome)).toEqual(["imported", "rejected"]);
      expect(result.data.batch).toMatchObject({ importedCount: 1, rejectedCount: 1 });

      const itemId = result.data.results[0]?.itemId ?? "";
      const item = await inTx<Awaited<ReturnType<typeof itemRegistryService.getItem>>>(
        fixture,
        (tx) => itemRegistryService.getItem(tx, itemId),
      );
      expect(item.data.status).toBe("DRAFT");
      expect(item.data.tags).toEqual(["candles", "basics", "imported"]);
      const key = item.data.answerKeyJson as { correctOptionIds: string[]; explanation: string };
      const correct = (item.data.options ?? [])
        .filter((option) => option.isCorrect === true)
        .map((option) => option.id);
      expect([...key.correctOptionIds].sort()).toEqual([...correct].sort());
      expect(correct).toHaveLength(2);
      expect(key.explanation).toBe("Both close near their highs.");

      const weights = await inTx<
        Awaited<ReturnType<typeof itemRegistryService.listDimensionWeights>>
      >(fixture, (tx) => itemRegistryService.listDimensionWeights(tx, itemId));
      expect(weights.data.map((weight) => [weight.dimensionId, Number(weight.weight)])).toEqual([
        [dimension.id, 0.5],
      ]);

      const source = await inTx<
        Array<{ import_batch_id: string; import_row_number: number; import_reference: string }>
      >(
        fixture,
        (tx) => tx.$queryRaw`
          select import_batch_id::text, import_row_number, import_reference
            from items where id = ${itemId}::uuid
        `,
      );
      expect(source[0]).toEqual({
        import_batch_id: batch.data.id,
        import_row_number: 2,
        import_reference: "Q-001",
      });

      const audit = await inTx<Array<{ action: string; metadata_json: unknown }>>(
        fixture,
        (tx) => tx.$queryRaw`
          select action, metadata_json from audit_entries
           where target_id = ${itemId} and action = 'item.created'
        `,
      );
      expect(audit).toHaveLength(1);
      expect(audit[0]?.metadata_json).toMatchObject({ importBatchId: batch.data.id, rowNumber: 2 });

      const completed = await inTx<Awaited<ReturnType<typeof itemImportService.completeBatch>>>(
        fixture,
        (tx) => itemImportService.completeBatch(tx, instructorCtx(fixture), batch.data.id),
      );
      expect(completed.data.status).toBe("completed");
      expect(completed.data.completedAt).not.toBeNull();
    });

    it("never imports a row twice when a chunk is sent again", async () => {
      const fixture = await createItemRegistryFixture();
      const batch = await openBatch(fixture, { rowsToImport: 2, skipDuplicates: false });
      const send = () =>
        inTx<Awaited<ReturnType<typeof itemImportService.importRows>>>(fixture, (tx) =>
          itemImportService.importRows(tx, instructorCtx(fixture), batch.data.id, {
            template: identity("mcq_single"),
            rows: [mcqRow(2, "First"), mcqRow(3, "Second")],
          }),
        );

      const first = await send();
      const again = await send();
      expect(again.data.results.map((row) => row.outcome)).toEqual([
        "already_imported",
        "already_imported",
      ]);
      expect(again.data.results.map((row) => row.itemId)).toEqual(
        first.data.results.map((row) => row.itemId),
      );
      expect(again.data.batch.importedCount).toBe(2);
    });

    it("skips repeats of the bank, of earlier chunks and within a chunk", async () => {
      const fixture = await createItemRegistryFixture();
      const batch = await openBatch(fixture, { rowsToImport: 4 });
      const send = (rows: ImportRowPayload[]) =>
        inTx<Awaited<ReturnType<typeof itemImportService.importRows>>>(fixture, (tx) =>
          itemImportService.importRows(tx, instructorCtx(fixture), batch.data.id, {
            template: identity("mcq_single"),
            rows,
          }),
        );

      const first = await send([mcqRow(2, "Is a doji indecision?", { reference: "R-1" })]);
      const second = await send([
        mcqRow(3, "is a DOJI  indecision?"),
        mcqRow(4, "A different question", { reference: "R-1" }),
        mcqRow(5, "A new question"),
      ]);

      expect(first.data.results[0]?.outcome).toBe("imported");
      expect(second.data.results.map((row) => row.outcome)).toEqual([
        "duplicate",
        "duplicate",
        "imported",
      ]);
      expect(second.data.results[0]?.itemId).toBe(first.data.results[0]?.itemId);
      expect(second.data.batch).toMatchObject({ importedCount: 2, duplicateCount: 2 });
    });

    it("imports repeats when the admin chooses to keep them", async () => {
      const fixture = await createItemRegistryFixture();
      const batch = await openBatch(fixture, { rowsToImport: 2, skipDuplicates: false });
      const result = await inTx<Awaited<ReturnType<typeof itemImportService.importRows>>>(
        fixture,
        (tx) =>
          itemImportService.importRows(tx, instructorCtx(fixture), batch.data.id, {
            template: identity("mcq_single"),
            rows: [mcqRow(2, "Same"), mcqRow(3, "same")],
          }),
      );
      expect(result.data.results.map((row) => row.outcome)).toEqual(["imported", "imported"]);
    });

    it("keeps an import to the member who started it, and closes it once complete", async () => {
      const fixture = await createItemRegistryFixture();
      const batch = await openBatch(fixture, { rowsToImport: 3 });
      const send = (ctx: ReturnType<typeof instructorCtx>, rowNumber: number) =>
        inTx(fixture, (tx) =>
          itemImportService.importRows(tx, ctx, batch.data.id, {
            template: identity("mcq_single"),
            rows: [mcqRow(rowNumber, `Question ${String(rowNumber)}`)],
          }),
        );

      await expect(send(otherInstructorCtx(fixture), 2)).rejects.toMatchObject({ status: 404 });
      await expect(
        inTx(fixture, (tx) =>
          itemImportService.completeBatch(tx, otherInstructorCtx(fixture), batch.data.id),
        ),
      ).rejects.toMatchObject({ status: 404 });

      await send(instructorCtx(fixture), 2);
      await inTx(fixture, (tx) =>
        itemImportService.completeBatch(tx, instructorCtx(fixture), batch.data.id),
      );
      await expect(send(instructorCtx(fixture), 3)).rejects.toMatchObject({ status: 409 });
    });

    it("refuses more rows than the import was started with", async () => {
      const fixture = await createItemRegistryFixture();
      const batch = await openBatch(fixture, { rowsToImport: 1 });
      await expect(
        inTx(fixture, (tx) =>
          itemImportService.importRows(tx, instructorCtx(fixture), batch.data.id, {
            template: identity("mcq_single"),
            rows: [mcqRow(2, "One"), mcqRow(3, "Two")],
          }),
        ),
      ).rejects.toMatchObject({ status: 400 });
    });

    it("refuses rows of another type", async () => {
      const fixture = await createItemRegistryFixture();
      const batch = await openBatch(fixture, { rowsToImport: 1 });
      await expect(
        inTx(fixture, (tx) =>
          itemImportService.importRows(tx, instructorCtx(fixture), batch.data.id, {
            template: identity("true_false"),
            rows: [{ rowNumber: 2, cells: { question: "Q", correct_answer: "TRUE" } }],
          }),
        ),
      ).rejects.toMatchObject({ status: 400 });
    });

    it("imports a full chunk well inside the transaction time limit", async () => {
      const fixture = await createItemRegistryFixture();
      const size = ITEM_IMPORT_CHUNK_MAX_ROWS;
      const batch = await openBatch(fixture, { rowsToImport: size });
      const rows = Array.from({ length: size }, (_, index) =>
        mcqRow(index + 2, `Load question ${String(index + 1)} about candles and risk?`, {
          option_c: "Doji",
          option_d: "Marubozu",
          tags: "load, chunk",
          reference: `L-${String(index + 1)}`,
        }),
      );

      const started = performance.now();
      const result = await inTx<Awaited<ReturnType<typeof itemImportService.importRows>>>(
        fixture,
        (tx) =>
          itemImportService.importRows(tx, instructorCtx(fixture), batch.data.id, {
            template: identity("mcq_single"),
            rows,
          }),
      );
      const seconds = (performance.now() - started) / 1000;

      expect(result.data.batch.importedCount).toBe(size);
      // The tenant transaction is cut off at DEFAULT_TENANT_TX_TIMEOUT_MS (30s).
      expect(seconds).toBeLessThan(DEFAULT_TENANT_TX_TIMEOUT_MS / 1000 / 3);
    });
  });

  describe("history and undo", () => {
    async function importQuestions(fixture: ItemRegistryFixture, questions: string[]) {
      const batch = await openBatch(fixture, { rowsToImport: questions.length });
      const result = await inTx<Awaited<ReturnType<typeof itemImportService.importRows>>>(
        fixture,
        (tx) =>
          itemImportService.importRows(tx, instructorCtx(fixture), batch.data.id, {
            template: identity("mcq_single"),
            rows: questions.map((question, index) => mcqRow(index + 2, question)),
          }),
      );
      await inTx(fixture, (tx) =>
        itemImportService.completeBatch(tx, instructorCtx(fixture), batch.data.id),
      );
      return {
        batchId: batch.data.id,
        itemIds: result.data.results.map((row) => row.itemId ?? ""),
      };
    }

    it("lists the academy's imports newest first, with what is left of each", async () => {
      const fixture = await createItemRegistryFixture();
      const first = await importQuestions(fixture, ["History one?", "History two?"]);
      const second = await importQuestions(fixture, ["History three?"]);
      await inTx(fixture, (tx) =>
        itemRegistryService.bulkSetItemStatus(tx, instructorCtx(fixture), {
          status: "PUBLISHED",
          itemIds: [first.itemIds[0] ?? ""],
        }),
      );

      const mine = await inTx<Awaited<ReturnType<typeof itemImportService.listBatches>>>(
        fixture,
        (tx) => itemImportService.listBatches(tx, instructorCtx(fixture), { limit: 1 }),
      );
      expect(mine.data.map((batch) => batch.id)).toEqual([second.batchId]);
      expect(mine.page.hasMore).toBe(true);

      const next = await inTx<Awaited<ReturnType<typeof itemImportService.listBatches>>>(
        fixture,
        (tx) =>
          itemImportService.listBatches(tx, instructorCtx(fixture), {
            limit: 10,
            cursor: mine.page.nextCursor ?? undefined,
          }),
      );
      expect(next.data).toHaveLength(1);
      expect(next.data[0]).toMatchObject({
        id: first.batchId,
        status: "completed",
        importedCount: 2,
        liveCount: 2,
        publishedCount: 1,
        ownedByYou: true,
        undoneAt: null,
      });

      // Another author sees the history but does not own it.
      const theirs = await inTx<Awaited<ReturnType<typeof itemImportService.listBatches>>>(
        fixture,
        (tx) => itemImportService.listBatches(tx, otherInstructorCtx(fixture), { limit: 10 }),
      );
      expect(theirs.data.map((batch) => batch.ownedByYou)).toEqual([false, false]);
    });

    it("removes the questions nothing uses and keeps those in a collection", async () => {
      const fixture = await createItemRegistryFixture();
      const imported = await importQuestions(fixture, ["Undo one?", "Undo two?", "Undo three?"]);
      const [inDeck, , published] = imported.itemIds;
      await inTx(fixture, (tx) =>
        itemRegistryService.addItemToCollection(tx, instructorCtx(fixture), fixture.collectionId, {
          itemId: inDeck ?? "",
          position: 1,
        }),
      );
      await inTx(fixture, (tx) =>
        itemRegistryService.bulkSetItemStatus(tx, instructorCtx(fixture), {
          status: "PUBLISHED",
          itemIds: [published ?? ""],
        }),
      );

      const undone = await inTx<Awaited<ReturnType<typeof itemImportService.undoBatch>>>(
        fixture,
        (tx) => itemImportService.undoBatch(tx, instructorCtx(fixture), imported.batchId),
      );
      expect(undone.data).toMatchObject({ removed: 2, kept: 1 });
      expect(undone.data.batch.status).toBe("undone");
      expect(undone.data.batch.undoneAt).not.toBeNull();

      const left = await inTx<Array<{ id: string; deleted: boolean; status: string }>>(
        fixture,
        (tx) => tx.$queryRaw`
          select id::text as id, deleted_at is not null as deleted, status::text as status
            from items where import_batch_id = ${imported.batchId}::uuid
        `,
      );
      const byId = new Map(left.map((row) => [row.id, row]));
      expect(byId.get(inDeck ?? "")).toMatchObject({ deleted: false });
      expect(byId.get(published ?? "")).toMatchObject({ deleted: true, status: "ARCHIVED" });

      const audit = await inTx<Array<{ metadata: unknown }>>(
        fixture,
        (tx) => tx.$queryRaw`
          select metadata_json as metadata from audit_entries
           where action = 'item_import_batch.undone' and target_id = ${imported.batchId}
        `,
      );
      expect(audit[0]?.metadata).toMatchObject({ removed: 2, kept: 1 });

      // Once only.
      await expect(
        inTx(fixture, (tx) =>
          itemImportService.undoBatch(tx, instructorCtx(fixture), imported.batchId),
        ),
      ).rejects.toMatchObject({ status: 409 });
    });

    it("lets only the admin who ran an import undo it", async () => {
      const fixture = await createItemRegistryFixture();
      const imported = await importQuestions(fixture, ["Owner only?"]);
      await expect(
        inTx(fixture, (tx) =>
          itemImportService.undoBatch(tx, otherInstructorCtx(fixture), imported.batchId),
        ),
      ).rejects.toMatchObject({ status: 404 });
    });
  });
});
