import { randomUUID } from "node:crypto";
import type { TenantTx } from "@atlas/db";
import { auditWriter } from "@atlas/audit";
import { listDimensions } from "../competency/competency-config.repository";
import {
  checkImportTemplate,
  importRowFromPayload,
  type CreateItemImportBatchBody,
  type ImportItemRowsBody,
  type ImportRowPayload,
  type ImportTemplateIdentity,
  type ItemImportBatch,
  type ItemImportCheckBody,
  type ItemImportCheckedRow,
  type ItemImportRowResult,
} from "./item-import-api.contract";
import {
  ITEM_IMPORT_MAX_TAGS,
  rowToItemDefinition,
  type ImportDimension,
  type ImportedItem,
  type ImportRow,
} from "./item-import.contract";
import {
  itemImportBatchClosed,
  itemImportBatchNotFound,
  itemImportFileInvalid,
} from "./item-registry.errors";
import { resolveItemDefinition } from "./item-registry.service";
import { encodeExplanationJson } from "./item-registry.repository";
import {
  itemImportRepository,
  type ImportBatchRow,
  type ImportItemInsert,
} from "./item-import.repository";

type ServiceCtx = {
  tenantId: string;
  actorMembershipId: string;
  requestId: string;
};

function auditActor(ctx: ServiceCtx) {
  return {
    tenantId: ctx.tenantId,
    actorMembershipId: ctx.actorMembershipId,
    platformPrincipalId: null,
    requestId: ctx.requestId,
  };
}

function mapBatch(row: ImportBatchRow): ItemImportBatch {
  return {
    id: row.id,
    itemTypeKey: row.item_type_key,
    fileName: row.file_name,
    templateVersion: row.template_version,
    status: row.status,
    rowsInFile: row.rows_in_file,
    rowsWithErrors: row.rows_with_errors,
    rowsToImport: row.rows_to_import,
    importedCount: row.imported_count,
    duplicateCount: row.duplicate_count,
    rejectedCount: row.rejected_count,
    skipDuplicates: row.skip_duplicates,
    extraTags: row.extra_tags,
    createdByMembershipId: row.created_by_membership_id,
    createdAt: row.created_at.toISOString(),
    completedAt: row.completed_at ? row.completed_at.toISOString() : null,
  };
}

async function importDimensions(tx: TenantTx): Promise<ImportDimension[]> {
  return (await listDimensions({ tx })).map((dimension) => ({
    id: dimension.id,
    name: dimension.name,
  }));
}

/** The file must be the current template for its type, columns in place. */
function requireTemplate(identity: ImportTemplateIdentity, dimensions: ImportDimension[]) {
  const check = checkImportTemplate(identity, identity.itemTypeKey, dimensions);
  if (!check.ok) throw itemImportFileInvalid(check.message);
  return new Set(check.columns);
}

/** A sent row as the template reads it: only the template's own columns. */
function rowCells(row: ImportRowPayload, columns: Set<string>): ImportRow {
  const cells = importRowFromPayload(row.cells);
  return Object.fromEntries(Object.entries(cells).filter(([key]) => columns.has(key)));
}

function sameTag(a: string, b: string) {
  return a.toLocaleLowerCase() === b.toLocaleLowerCase();
}

function withExtraTags(item: ImportedItem, extraTags: string[]) {
  const tags = [...item.tags];
  for (const tag of extraTags) {
    if (!tags.some((other) => sameTag(other, tag))) tags.push(tag);
  }
  return tags;
}

export const itemImportService = {
  /**
   * Every row checked as the import will check it, and compared with the
   * bank. Nothing is written. Repeats within the file are for the browser to
   * find, across all its requests, from the fingerprints returned here.
   */
  async checkRows(
    tx: TenantTx,
    ctx: ServiceCtx,
    input: ItemImportCheckBody,
  ): Promise<{ data: { rows: ItemImportCheckedRow[] } }> {
    const dimensions = await importDimensions(tx);
    const columns = requireTemplate(input.template, dimensions);
    const type = input.template.itemTypeKey;

    const read = input.rows.map((row) => ({
      rowNumber: row.rowNumber,
      result: rowToItemDefinition(type, rowCells(row, columns), dimensions),
    }));
    const ready = read.flatMap((row) => (row.result.ok ? [row.result.item] : []));
    const fingerprints = await itemImportRepository.fingerprints(
      tx,
      ready.map((item) => item.contentJson.stem),
    );
    const bankByFingerprint = await itemImportRepository.findByFingerprints(tx, {
      tenantId: ctx.tenantId,
      itemTypeKey: type,
      fingerprints,
    });
    const bankByReference = await itemImportRepository.findByReferences(tx, {
      tenantId: ctx.tenantId,
      references: ready.flatMap((item) => (item.reference ? [item.reference] : [])),
    });

    let readyIndex = 0;
    const rows = read.map((row): ItemImportCheckedRow => {
      if (!row.result.ok) {
        return {
          rowNumber: row.rowNumber,
          status: "invalid",
          issues: row.result.issues,
          duplicateOf: null,
          fingerprint: null,
          reference: null,
        };
      }
      const item = row.result.item;
      const fingerprint = fingerprints[readyIndex] ?? null;
      readyIndex += 1;
      const byQuestion = fingerprint ? bankByFingerprint.get(fingerprint) : undefined;
      const byReference = item.reference ? bankByReference.get(item.reference) : undefined;
      const duplicateOf = byQuestion
        ? { itemId: byQuestion, reason: "question" as const }
        : byReference
          ? { itemId: byReference, reason: "reference" as const }
          : null;
      return {
        rowNumber: row.rowNumber,
        status: duplicateOf ? "duplicate" : "ready",
        issues: [],
        duplicateOf,
        fingerprint,
        reference: item.reference,
      };
    });

    return { data: { rows } };
  },

  async createBatch(
    tx: TenantTx,
    ctx: ServiceCtx,
    input: CreateItemImportBatchBody,
  ): Promise<{ data: ItemImportBatch }> {
    requireTemplate(input.template, await importDimensions(tx));
    const extraTags: string[] = [];
    for (const tag of input.extraTags) {
      if (!extraTags.some((other) => sameTag(other, tag))) extraTags.push(tag);
    }

    const batch = await itemImportRepository.createBatch(tx, {
      tenantId: ctx.tenantId,
      itemTypeKey: input.template.itemTypeKey,
      fileName: input.fileName,
      templateVersion: input.template.version,
      rowsInFile: input.rowsInFile,
      rowsWithErrors: input.rowsWithErrors,
      rowsToImport: input.rowsToImport,
      skipDuplicates: input.skipDuplicates,
      extraTags,
      createdByMembershipId: ctx.actorMembershipId,
    });
    const data = mapBatch(batch);
    await auditWriter.write(tx, auditActor(ctx), {
      action: "item_import_batch.created",
      target: { type: "item_import_batch", id: batch.id },
      before: null,
      after: data,
      metadata: {},
    });
    return { data };
  },

  /**
   * One chunk of rows, in one transaction. The batch row is locked first, so
   * chunks of the same import run one after another and each sees the
   * questions the previous ones created: a repeat across chunks is caught as
   * surely as one within a chunk.
   */
  async importRows(
    tx: TenantTx,
    ctx: ServiceCtx,
    batchId: string,
    input: ImportItemRowsBody,
  ): Promise<{ data: { batch: ItemImportBatch; results: ItemImportRowResult[] } }> {
    const batch = await itemImportRepository.lockBatch(tx, batchId);
    if (!batch || batch.created_by_membership_id !== ctx.actorMembershipId) {
      throw itemImportBatchNotFound();
    }
    if (batch.status !== "importing") throw itemImportBatchClosed();
    if (input.template.itemTypeKey !== batch.item_type_key) {
      throw itemImportFileInvalid("These rows are for a different question type than this import.");
    }
    const dimensions = await importDimensions(tx);
    const columns = requireTemplate(input.template, dimensions);
    const type = input.template.itemTypeKey;

    const already = await itemImportRepository.importedRows(tx, {
      tenantId: ctx.tenantId,
      batchId,
      rowNumbers: input.rows.map((row) => row.rowNumber),
    });

    const results = new Map<number, ItemImportRowResult>();
    const accepted: Array<{ rowNumber: number; item: ImportedItem; tags: string[] }> = [];
    for (const row of input.rows) {
      const existing = already.get(row.rowNumber);
      if (existing) {
        results.set(row.rowNumber, {
          rowNumber: row.rowNumber,
          outcome: "already_imported",
          itemId: existing,
          issues: [],
        });
        continue;
      }
      const result = rowToItemDefinition(type, rowCells(row, columns), dimensions);
      if (!result.ok) {
        results.set(row.rowNumber, {
          rowNumber: row.rowNumber,
          outcome: "rejected",
          itemId: null,
          issues: result.issues,
        });
        continue;
      }
      const tags = withExtraTags(result.item, batch.extra_tags);
      if (tags.length > ITEM_IMPORT_MAX_TAGS) {
        results.set(row.rowNumber, {
          rowNumber: row.rowNumber,
          outcome: "rejected",
          itemId: null,
          issues: [
            {
              columns: ["tags"],
              message: `With the tags added to every question, this question has more than ${String(ITEM_IMPORT_MAX_TAGS)} tags.`,
            },
          ],
        });
        continue;
      }
      accepted.push({ rowNumber: row.rowNumber, item: result.item, tags });
    }

    let toInsert = accepted;
    if (batch.skip_duplicates && accepted.length > 0) {
      const fingerprints = await itemImportRepository.fingerprints(
        tx,
        accepted.map((entry) => entry.item.contentJson.stem),
      );
      const bankByFingerprint = await itemImportRepository.findByFingerprints(tx, {
        tenantId: ctx.tenantId,
        itemTypeKey: type,
        fingerprints,
      });
      const bankByReference = await itemImportRepository.findByReferences(tx, {
        tenantId: ctx.tenantId,
        references: accepted.flatMap((entry) =>
          entry.item.reference ? [entry.item.reference] : [],
        ),
      });
      const seenFingerprints = new Set<string>();
      const seenReferences = new Set<string>();
      toInsert = [];
      for (const [index, entry] of accepted.entries()) {
        const fingerprint = fingerprints[index] ?? "";
        const reference = entry.item.reference;
        const repeat =
          bankByFingerprint.has(fingerprint) ||
          seenFingerprints.has(fingerprint) ||
          (reference !== null && (bankByReference.has(reference) || seenReferences.has(reference)));
        seenFingerprints.add(fingerprint);
        if (reference !== null) seenReferences.add(reference);
        if (repeat) {
          results.set(entry.rowNumber, {
            rowNumber: entry.rowNumber,
            outcome: "duplicate",
            itemId:
              bankByFingerprint.get(fingerprint) ??
              (reference !== null ? (bankByReference.get(reference) ?? null) : null),
            issues: [],
          });
        } else {
          toInsert.push(entry);
        }
      }
    }

    const counts = {
      imported: toInsert.length,
      duplicate: [...results.values()].filter((result) => result.outcome === "duplicate").length,
      rejected: [...results.values()].filter((result) => result.outcome === "rejected").length,
    };
    const processed = batch.imported_count + batch.duplicate_count + batch.rejected_count;
    if (processed + counts.imported + counts.duplicate + counts.rejected > batch.rows_to_import) {
      throw itemImportFileInvalid(
        "This import has been sent more rows than it was started with. Start the import again.",
      );
    }

    const inserts: ImportItemInsert[] = toInsert.map((entry) => {
      const definition = resolveItemDefinition({
        itemTypeKey: type,
        contentJson: entry.item.contentJson,
        answerKeyJson: entry.item.answerKeyJson,
        options: entry.item.options,
      });
      return {
        id: randomUUID(),
        rowNumber: entry.rowNumber,
        stemJson: entry.item.contentJson,
        explanationJson: encodeExplanationJson({ answerKeyJson: definition.answerKeyJson }),
        tags: entry.tags,
        reference: entry.item.reference,
        options: (definition.options ?? []).map((option) => ({
          id: option.id ?? randomUUID(),
          optionJson: option.optionJson,
          isCorrect: option.isCorrect ?? null,
          position: option.position,
        })),
        weights: entry.item.weights.map((weight) => ({ id: randomUUID(), ...weight })),
      };
    });

    await itemImportRepository.insertItems(tx, {
      tenantId: ctx.tenantId,
      itemTypeKey: type,
      batchId,
      createdByMembershipId: ctx.actorMembershipId,
      items: inserts,
    });

    // The same record a question created by hand gets (audit M7), with the
    // import it came from.
    for (const insert of inserts) {
      const answerKey = (insert.explanationJson as { answerKey?: unknown } | null)?.answerKey;
      await auditWriter.write(tx, auditActor(ctx), {
        action: "item.created",
        target: { type: "item", id: insert.id },
        before: null,
        after: {
          itemTypeKey: type,
          status: "DRAFT",
          tags: insert.tags,
          contentJson: insert.stemJson,
          answerKeyJson: answerKey ?? null,
          options: insert.options.map((option) => ({
            position: option.position,
            optionJson: option.optionJson,
            isCorrect: option.isCorrect,
          })),
        },
        metadata: { importBatchId: batchId, rowNumber: insert.rowNumber },
      });
      results.set(insert.rowNumber, {
        rowNumber: insert.rowNumber,
        outcome: "imported",
        itemId: insert.id,
        issues: [],
      });
    }

    const updated = await itemImportRepository.addCounts(tx, batchId, counts);
    return {
      data: {
        batch: mapBatch(updated),
        results: input.rows.flatMap((row) => {
          const result = results.get(row.rowNumber);
          return result ? [result] : [];
        }),
      },
    };
  },

  async completeBatch(
    tx: TenantTx,
    ctx: ServiceCtx,
    batchId: string,
  ): Promise<{ data: ItemImportBatch }> {
    const batch = await itemImportRepository.lockBatch(tx, batchId);
    if (!batch || batch.created_by_membership_id !== ctx.actorMembershipId) {
      throw itemImportBatchNotFound();
    }
    if (batch.status === "completed") return { data: mapBatch(batch) };
    if (batch.status !== "importing") throw itemImportBatchClosed();

    const completed = await itemImportRepository.completeBatch(tx, batchId);
    const data = mapBatch(completed);
    await auditWriter.write(tx, auditActor(ctx), {
      action: "item_import_batch.completed",
      target: { type: "item_import_batch", id: batchId },
      before: { status: batch.status },
      after: {
        status: data.status,
        importedCount: data.importedCount,
        duplicateCount: data.duplicateCount,
        rejectedCount: data.rejectedCount,
      },
      metadata: {},
    });
    return { data };
  },
};
