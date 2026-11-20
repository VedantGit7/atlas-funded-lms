import { z } from "zod";
import { VALIDATED_ITEM_TYPES, type ValidatedItemTypeKey } from "./item-definition.contract";
import {
  ITEM_IMPORT_FORMAT,
  ITEM_IMPORT_MAX_ROWS,
  ITEM_IMPORT_TAG_MAX_LENGTH,
  ITEM_IMPORT_TEMPLATE_VERSION,
  ITEM_IMPORT_TYPE_NAMES,
  itemImportColumns,
  type ImportCell,
  type ImportDimension,
  type ImportRow,
} from "./item-import.contract";

/**
 * The requests that import questions from a filled-in template. The browser
 * reads the file and sends its rows as JSON; the server never opens a
 * spreadsheet someone uploaded.
 *
 * 1. POST /items/import/check: every row checked and compared with the bank,
 *    nothing written. Up to ITEM_IMPORT_CHECK_MAX_ROWS rows per request.
 * 2. POST /items/import-batches: opens a batch for the rows the admin keeps.
 * 3. POST /items/import-batches/{id}/rows: imports a chunk, in one
 *    transaction. A row already imported into the batch is never imported
 *    again, so a chunk can be sent twice safely.
 * 4. POST /items/import-batches/{id}/complete.
 *
 * Requests are kept under ITEM_IMPORT_REQUEST_MAX_BYTES because the web proxy
 * refuses bodies over 4 MB.
 */

export const ITEM_IMPORT_CHECK_MAX_ROWS = 1_000;
export const ITEM_IMPORT_CHUNK_MAX_ROWS = 500;
export const ITEM_IMPORT_REQUEST_MAX_BYTES = 3_000_000;
/** Bigger than any honest 5,000-question file; refused before it is read. */
export const ITEM_IMPORT_FILE_MAX_BYTES = 10 * 1024 * 1024;
export const ITEM_IMPORT_EXTRA_TAGS_MAX = 20;

const CELL_TEXT_MAX = 20_000;
const COLUMNS_MAX = 80;

/** A date cell travels as { date: ISO string }, so it can still be refused. */
export const ImportCellPayloadSchema = z.union([
  z.string().max(CELL_TEXT_MAX),
  z.number(),
  z.boolean(),
  z.null(),
  z.object({ date: z.string().max(40) }).strict(),
]);
export type ImportCellPayload = z.infer<typeof ImportCellPayloadSchema>;

export const ImportRowPayloadSchema = z
  .object({
    /** The row on the Questions sheet: 2 is the first question. */
    rowNumber: z
      .number()
      .int()
      .min(2)
      .max(ITEM_IMPORT_MAX_ROWS + 1),
    cells: z
      .record(z.string().min(1).max(COLUMNS_MAX), ImportCellPayloadSchema)
      .refine((cells) => Object.keys(cells).length <= COLUMNS_MAX, {
        message: "Too many columns.",
      }),
  })
  .strict();
export type ImportRowPayload = z.infer<typeof ImportRowPayloadSchema>;

/** What the file says about itself (its hidden _template sheet and header). */
export const ImportTemplateIdentitySchema = z
  .object({
    format: z.string().max(80),
    version: z.string().max(20),
    itemTypeKey: z.enum(VALIDATED_ITEM_TYPES),
    columns: z.array(z.string().max(COLUMNS_MAX)).max(COLUMNS_MAX),
    headers: z.array(z.string().max(300)).max(200),
  })
  .strict();
export type ImportTemplateIdentity = z.infer<typeof ImportTemplateIdentitySchema>;

function uniqueRowNumbers(rows: ImportRowPayload[]) {
  return new Set(rows.map((row) => row.rowNumber)).size === rows.length;
}

export const ItemImportCheckBodySchema = z
  .object({
    template: ImportTemplateIdentitySchema,
    rows: z
      .array(ImportRowPayloadSchema)
      .min(1)
      .max(ITEM_IMPORT_CHECK_MAX_ROWS)
      .refine(uniqueRowNumbers, { message: "Each row may be sent once." }),
  })
  .strict();
export type ItemImportCheckBody = z.infer<typeof ItemImportCheckBodySchema>;

const IssueSchema = z.object({ columns: z.array(z.string()), message: z.string() });

export const ItemImportCheckedRowSchema = z.object({
  rowNumber: z.number().int(),
  status: z.enum(["ready", "invalid", "duplicate"]),
  issues: z.array(IssueSchema),
  /** The question already in the bank that this row repeats. */
  duplicateOf: z
    .object({ itemId: z.string(), reason: z.enum(["question", "reference"]) })
    .nullable(),
  /**
   * The question's wording reduced to compare it with others (case and runs
   * of spaces ignored), so the browser can find repeats across the whole file.
   */
  fingerprint: z.string().nullable(),
  reference: z.string().nullable(),
});
export type ItemImportCheckedRow = z.infer<typeof ItemImportCheckedRowSchema>;

export const ItemImportCheckResponseSchema = z.object({
  data: z.object({ rows: z.array(ItemImportCheckedRowSchema) }),
});
export type ItemImportCheckResponse = z.infer<typeof ItemImportCheckResponseSchema>;

const ExtraTagsSchema = z
  .array(z.string().trim().min(1).max(ITEM_IMPORT_TAG_MAX_LENGTH))
  .max(ITEM_IMPORT_EXTRA_TAGS_MAX);

export const CreateItemImportBatchBodySchema = z
  .object({
    template: ImportTemplateIdentitySchema,
    fileName: z.string().trim().min(1).max(255),
    rowsInFile: z.number().int().min(1).max(ITEM_IMPORT_MAX_ROWS),
    rowsWithErrors: z.number().int().min(0).max(ITEM_IMPORT_MAX_ROWS),
    rowsToImport: z.number().int().min(1).max(ITEM_IMPORT_MAX_ROWS),
    skipDuplicates: z.boolean(),
    extraTags: ExtraTagsSchema.default([]),
  })
  .strict()
  .refine((body) => body.rowsWithErrors + body.rowsToImport <= body.rowsInFile, {
    message: "More rows to import than the file has.",
    path: ["rowsToImport"],
  });
export type CreateItemImportBatchBody = z.infer<typeof CreateItemImportBatchBodySchema>;

export const ImportItemRowsBodySchema = z
  .object({
    template: ImportTemplateIdentitySchema,
    rows: z
      .array(ImportRowPayloadSchema)
      .min(1)
      .max(ITEM_IMPORT_CHUNK_MAX_ROWS)
      .refine(uniqueRowNumbers, { message: "Each row may be sent once." }),
  })
  .strict();
export type ImportItemRowsBody = z.infer<typeof ImportItemRowsBodySchema>;

export const ItemImportBatchParamsSchema = z.object({ id: z.uuid() });

export const ItemImportBatchSchema = z.object({
  id: z.string(),
  itemTypeKey: z.string(),
  fileName: z.string(),
  templateVersion: z.string(),
  status: z.enum(["importing", "completed", "undone"]),
  rowsInFile: z.number().int(),
  rowsWithErrors: z.number().int(),
  rowsToImport: z.number().int(),
  importedCount: z.number().int(),
  duplicateCount: z.number().int(),
  rejectedCount: z.number().int(),
  skipDuplicates: z.boolean(),
  extraTags: z.array(z.string()),
  createdByMembershipId: z.string(),
  createdAt: z.string(),
  completedAt: z.string().nullable(),
  undoneAt: z.string().nullable(),
});
export type ItemImportBatch = z.infer<typeof ItemImportBatchSchema>;

/**
 * What happened to every row of the file, for the summary an admin reads.
 *
 * The browser leaves skipped duplicates out of the upload, so the batch's own
 * duplicateCount holds only the repeats the server caught at import time (a
 * question added between the check and the import). The rest are the rows
 * neither invalid nor sent: rowsInFile - rowsWithErrors - rowsToImport.
 */
export function itemImportBatchSummary(batch: ItemImportBatch): {
  imported: number;
  duplicatesSkipped: number;
  notImported: number;
} {
  const skippedBeforeUpload = Math.max(
    0,
    batch.rowsInFile - batch.rowsWithErrors - batch.rowsToImport,
  );
  return {
    imported: batch.importedCount,
    duplicatesSkipped: skippedBeforeUpload + batch.duplicateCount,
    notImported: batch.rowsWithErrors + batch.rejectedCount,
  };
}

export const ItemImportBatchResponseSchema = z.object({ data: ItemImportBatchSchema });

export const ITEM_IMPORT_HISTORY_PAGE_MAX = 50;

export const ItemImportBatchListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(ITEM_IMPORT_HISTORY_PAGE_MAX).default(20),
  /** The last batch id of the previous page (page.nextCursor). */
  cursor: z.uuid().optional(),
});
export type ItemImportBatchListQuery = z.infer<typeof ItemImportBatchListQuerySchema>;

/**
 * A batch in the history. liveCount: its questions still in the bank;
 * publishedCount: those of them published. ownedByYou: the viewer ran the
 * import, so may publish its questions or undo it.
 */
export const ItemImportHistoryEntrySchema = ItemImportBatchSchema.extend({
  liveCount: z.number().int().nonnegative(),
  publishedCount: z.number().int().nonnegative(),
  ownedByYou: z.boolean(),
});
export type ItemImportHistoryEntry = z.infer<typeof ItemImportHistoryEntrySchema>;

export const ItemImportBatchListResponseSchema = z.object({
  data: z.array(ItemImportHistoryEntrySchema),
  page: z.object({ nextCursor: z.string().nullable(), hasMore: z.boolean() }),
});

/**
 * removed: questions taken out of the bank. kept: questions left because a
 * collection, deck or assessment uses them or learners have answered them.
 */
export const UndoItemImportBatchResponseSchema = z.object({
  data: z.object({
    batch: ItemImportBatchSchema,
    removed: z.number().int().nonnegative(),
    kept: z.number().int().nonnegative(),
  }),
});

export const ItemImportRowResultSchema = z.object({
  rowNumber: z.number().int(),
  /**
   * imported: a new Draft question. duplicate: skipped, the question is
   * already in the bank. rejected: the row is not a valid question.
   * already_imported: this batch imported the row before (a resent chunk).
   */
  outcome: z.enum(["imported", "duplicate", "rejected", "already_imported"]),
  itemId: z.string().nullable(),
  issues: z.array(IssueSchema),
});
export type ItemImportRowResult = z.infer<typeof ItemImportRowResultSchema>;

export const ImportItemRowsResponseSchema = z.object({
  data: z.object({
    batch: ItemImportBatchSchema,
    results: z.array(ItemImportRowResultSchema),
  }),
});
export type ImportItemRowsResponse = z.infer<typeof ImportItemRowsResponseSchema>;

// --- Shared checks ------------------------------------------------------

/** A row as `rowToItemDefinition` reads it: dates back to Date. */
export function importRowFromPayload(cells: Record<string, ImportCellPayload>): ImportRow {
  const row: ImportRow = {};
  for (const [key, value] of Object.entries(cells)) {
    let cell: ImportCell;
    if (value !== null && typeof value === "object") {
      const date = new Date(value.date);
      cell = Number.isNaN(date.getTime()) ? value.date : date;
    } else {
      cell = value;
    }
    row[key] = cell;
  }
  return row;
}

/** The other way, for sending a row read in the browser. */
export function importCellToPayload(value: unknown): ImportCellPayload {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : { date: value.toISOString() };
  }
  if (typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  return null;
}

function headerMatches(header: string, expected: string) {
  const normalized = header.replace(/\s+/g, " ").trim().toLowerCase();
  const plain = expected.toLowerCase();
  return normalized === plain || normalized === `${plain} *` || normalized === `${plain}*`;
}

export type TemplateCheck = { ok: true; columns: string[] } | { ok: false; message: string };

/**
 * Whether a filled-in file is the current template for the chosen type, with
 * its columns where the template put them. A column that was moved, renamed
 * or deleted would otherwise put answers under the wrong heading.
 *
 * Weight columns may be fewer than the academy has now (a dimension added
 * since the download simply gets no weight) but must not name a dimension
 * that no longer exists.
 */
export function checkImportTemplate(
  identity: ImportTemplateIdentity,
  expectedType: ValidatedItemTypeKey,
  dimensions: ImportDimension[],
): TemplateCheck {
  const fresh = "Download a new template from Create item and copy your questions into it.";
  if (identity.format !== ITEM_IMPORT_FORMAT) {
    return {
      ok: false,
      message: `This file is not a question import template. ${fresh}`,
    };
  }
  if (identity.version !== ITEM_IMPORT_TEMPLATE_VERSION) {
    return {
      ok: false,
      message: `This template is version ${identity.version}, and the current version is ${ITEM_IMPORT_TEMPLATE_VERSION}. ${fresh}`,
    };
  }
  if (identity.itemTypeKey !== expectedType) {
    return {
      ok: false,
      message: `This is the ${ITEM_IMPORT_TYPE_NAMES[identity.itemTypeKey]} template, but you are importing ${ITEM_IMPORT_TYPE_NAMES[expectedType]} questions. Choose ${ITEM_IMPORT_TYPE_NAMES[identity.itemTypeKey]} or upload the right template.`,
    };
  }

  const expected = itemImportColumns(expectedType, []);
  const baseKeys = identity.columns.filter((key) => !key.startsWith("weight:"));
  const weightKeys = identity.columns.filter((key) => key.startsWith("weight:"));
  if (
    baseKeys.length !== expected.length ||
    baseKeys.some((key, index) => key !== expected[index]?.key) ||
    identity.columns.slice(0, expected.length).some((key) => key.startsWith("weight:"))
  ) {
    return { ok: false, message: `This template's columns are not the current ones. ${fresh}` };
  }
  const dimensionIds = new Set(dimensions.map((dimension) => `weight:${dimension.id}`));
  const unknown = weightKeys.find((key) => !dimensionIds.has(key));
  if (unknown) {
    return {
      ok: false,
      message: `The file has a weight column for a competency dimension that no longer exists. ${fresh}`,
    };
  }
  if (new Set(identity.columns).size !== identity.columns.length) {
    return { ok: false, message: `This template's columns are not the current ones. ${fresh}` };
  }

  for (const [index, key] of identity.columns.entries()) {
    const header = identity.headers[index] ?? "";
    const column = expected.find((candidate) => candidate.key === key);
    const ok = column
      ? headerMatches(header, column.header)
      : header.replace(/\s+/g, " ").trim().toLowerCase().startsWith("weight:");
    if (!ok) {
      const name = column ? `"${column.header}"` : "a Weight column";
      return {
        ok: false,
        message: `Column ${columnLetter(index)} of the Questions sheet should be ${name}${header ? `, but it is "${header}"` : ", but it is empty"}. Do not rename, move or delete columns: put them back or use a new template.`,
      };
    }
  }
  const extra = identity.headers.findIndex(
    (header, index) => index >= identity.columns.length && header.trim() !== "",
  );
  if (extra !== -1) {
    return {
      ok: false,
      message: `Column ${columnLetter(extra)} ("${identity.headers[extra] ?? ""}") is not part of the template. Delete it and upload again.`,
    };
  }

  return { ok: true, columns: identity.columns };
}

export function columnLetter(index: number): string {
  let letters = "";
  let n = index + 1;
  while (n > 0) {
    const remainder = (n - 1) % 26;
    letters = String.fromCharCode(65 + remainder) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters;
}
