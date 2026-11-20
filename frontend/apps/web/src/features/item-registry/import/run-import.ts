import {
  ITEM_IMPORT_CHECK_MAX_ROWS,
  ITEM_IMPORT_CHUNK_MAX_ROWS,
  ITEM_IMPORT_REQUEST_MAX_BYTES,
  type ImportItemRowsResponse,
  type ImportRowPayload,
  type ImportTemplateIdentity,
  type ItemImportBatch,
  type ItemImportCheckResponse,
  type ItemImportRowResult,
} from "@atlas/contracts/item-registry/item-import-api.contract";
import type { ImportFile } from "./read-import-file";

/**
 * Checking and importing a file, a request at a time. Requests stay under
 * the web proxy's body limit, so a 5,000-question file goes in several.
 */

export type ImportApi = {
  check(body: {
    template: ImportTemplateIdentity;
    rows: ImportRowPayload[];
  }): Promise<ItemImportCheckResponse>;
  createBatch(
    body: {
      template: ImportTemplateIdentity;
      fileName: string;
      rowsInFile: number;
      rowsWithErrors: number;
      rowsToImport: number;
      skipDuplicates: boolean;
      extraTags: string[];
    },
    idempotencyKey: string,
  ): Promise<{ data: ItemImportBatch }>;
  importRows(
    batchId: string,
    body: { template: ImportTemplateIdentity; rows: ImportRowPayload[] },
    idempotencyKey: string,
  ): Promise<ImportItemRowsResponse>;
  complete(batchId: string, idempotencyKey: string): Promise<{ data: ItemImportBatch }>;
};

export type PreviewRow = {
  rowNumber: number;
  status: "ready" | "invalid" | "duplicate";
  issues: Array<{ columns: string[]; message: string }>;
  duplicate:
    | { in: "bank"; itemId: string; reason: "question" | "reference" }
    | { in: "file"; rowNumber: number; reason: "question" | "reference" }
    | null;
};

export type ImportProgress = { done: number; total: number };

const encoder = new TextEncoder();

/** Rows split so no request has too many rows or too many bytes. */
export function chunkRows(
  rows: ImportRowPayload[],
  maxRows: number,
  maxBytes: number = ITEM_IMPORT_REQUEST_MAX_BYTES,
): ImportRowPayload[][] {
  const chunks: ImportRowPayload[][] = [];
  let current: ImportRowPayload[] = [];
  let bytes = 0;
  for (const row of rows) {
    const size = encoder.encode(JSON.stringify(row)).length + 1;
    if (current.length > 0 && (current.length >= maxRows || bytes + size > maxBytes)) {
      chunks.push(current);
      current = [];
      bytes = 0;
    }
    current.push(row);
    bytes += size;
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

/**
 * Every row checked by the server, then repeats within the file marked: the
 * first copy of a question (or of a reference) is kept, later ones are
 * duplicates of it.
 */
export async function previewImport(
  file: ImportFile,
  api: ImportApi,
  onProgress: (progress: ImportProgress) => void,
): Promise<PreviewRow[]> {
  const chunks = chunkRows(file.rows, ITEM_IMPORT_CHECK_MAX_ROWS);
  const checked: ItemImportCheckResponse["data"]["rows"] = [];
  onProgress({ done: 0, total: file.rows.length });
  for (const chunk of chunks) {
    const response = await withRetry(() => api.check({ template: file.identity, rows: chunk }));
    checked.push(...response.data.rows);
    onProgress({ done: checked.length, total: file.rows.length });
  }

  const firstByFingerprint = new Map<string, number>();
  const firstByReference = new Map<string, number>();
  return checked.map((row): PreviewRow => {
    if (row.status === "invalid") {
      return { rowNumber: row.rowNumber, status: "invalid", issues: row.issues, duplicate: null };
    }
    const earlierQuestion = row.fingerprint ? firstByFingerprint.get(row.fingerprint) : undefined;
    const earlierReference = row.reference ? firstByReference.get(row.reference) : undefined;
    if (row.fingerprint && earlierQuestion === undefined) {
      firstByFingerprint.set(row.fingerprint, row.rowNumber);
    }
    if (row.reference && earlierReference === undefined) {
      firstByReference.set(row.reference, row.rowNumber);
    }
    if (row.duplicateOf) {
      return {
        rowNumber: row.rowNumber,
        status: "duplicate",
        issues: [],
        duplicate: { in: "bank", ...row.duplicateOf },
      };
    }
    const earlier =
      earlierQuestion !== undefined
        ? { rowNumber: earlierQuestion, reason: "question" as const }
        : earlierReference !== undefined
          ? { rowNumber: earlierReference, reason: "reference" as const }
          : null;
    return earlier
      ? {
          rowNumber: row.rowNumber,
          status: "duplicate",
          issues: [],
          duplicate: { in: "file", ...earlier },
        }
      : { rowNumber: row.rowNumber, status: "ready", issues: [], duplicate: null };
  });
}

export type ImportOutcome = {
  batch: ItemImportBatch;
  results: ItemImportRowResult[];
};

export async function runImport(
  file: ImportFile,
  preview: PreviewRow[],
  options: { skipDuplicates: boolean; extraTags: string[]; importKey: string },
  api: ImportApi,
  onProgress: (progress: ImportProgress) => void,
): Promise<ImportOutcome> {
  const keep = new Set(
    preview
      .filter(
        (row) => row.status === "ready" || (row.status === "duplicate" && !options.skipDuplicates),
      )
      .map((row) => row.rowNumber),
  );
  const rows = file.rows.filter((row) => keep.has(row.rowNumber));
  const rowsWithErrors = preview.filter((row) => row.status === "invalid").length;

  const opened = await withRetry(() =>
    api.createBatch(
      {
        template: file.identity,
        fileName: file.fileName.slice(0, 255),
        rowsInFile: file.rows.length,
        rowsWithErrors,
        rowsToImport: rows.length,
        skipDuplicates: options.skipDuplicates,
        extraTags: options.extraTags,
      },
      `item-import-${options.importKey}-open`,
    ),
  );
  const batchId = opened.data.id;

  const results: ItemImportRowResult[] = [];
  onProgress({ done: 0, total: rows.length });
  const chunks = chunkRows(rows, ITEM_IMPORT_CHUNK_MAX_ROWS);
  for (const [index, chunk] of chunks.entries()) {
    // The same key on a retry: a chunk that reached the server is answered
    // from its record, never imported twice.
    const response = await withRetry(() =>
      api.importRows(
        batchId,
        { template: file.identity, rows: chunk },
        `item-import-${batchId}-rows-${String(index)}`,
      ),
    );
    results.push(...response.data.results);
    onProgress({ done: results.length, total: rows.length });
  }

  const completed = await withRetry(() => api.complete(batchId, `item-import-${batchId}-complete`));
  return { batch: completed.data, results };
}

type ErrorWithStatus = { status?: unknown };

function retryable(error: unknown): boolean {
  const status = (error as ErrorWithStatus | null)?.status;
  if (typeof status !== "number") return error instanceof TypeError; // network
  return status === 429 || status === 502 || status === 503 || status === 504;
}

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

/** Retries a dropped connection or a busy server, never a refusal. */
export async function withRetry<T>(run: () => Promise<T>, delays = [2_000, 8_000, 20_000]) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await run();
    } catch (error) {
      const delay = delays[attempt];
      if (delay === undefined || !retryable(error)) throw error;
      await sleep(delay);
    }
  }
}
