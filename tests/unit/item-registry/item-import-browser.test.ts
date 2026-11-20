import { describe, expect, it, vi } from "vitest";
import ExcelJS from "../../../backend/packages/domain/node_modules/exceljs";
import type { ValidatedItemTypeKey } from "../../../backend/apps/api/src/server/item-registry/item-definition.contract";
import {
  checkImportTemplate,
  columnLetter,
  importCellToPayload,
  importRowFromPayload,
  itemImportBatchSummary,
  type ItemImportBatch,
  type ImportRowPayload,
  type ImportTemplateIdentity,
  type ItemImportCheckedRow,
} from "../../../backend/apps/api/src/server/item-registry/item-import-api.contract";
import {
  ITEM_IMPORT_FORMAT,
  ITEM_IMPORT_TEMPLATE_VERSION,
  itemImportColumns,
} from "../../../backend/apps/api/src/server/item-registry/item-import.contract";
import {
  ImportFileError,
  readImportFile,
} from "../../../frontend/apps/web/src/features/item-registry/import/read-import-file";
import {
  chunkRows,
  previewImport,
  runImport,
  withRetry,
  type ImportApi,
  type PreviewRow,
} from "../../../frontend/apps/web/src/features/item-registry/import/run-import";

/**
 * The browser half of importing questions: reading a filled-in template,
 * refusing the wrong one, and sending it in requests the proxy accepts.
 */

const dimension = { id: "11111111-1111-4111-8111-111111111111", name: "Risk" };

vi.mock("../../../backend/apps/api/src/server/competency/competency-config.repository", () => ({
  listDimensions: vi.fn(async () => [{ ...dimension, key: "risk", description: null }]),
}));

const { buildItemImportTemplate } =
  await import("../../../backend/apps/api/src/server/item-registry/item-import-template.service");

function identity(
  type: ValidatedItemTypeKey = "mcq_single",
  dimensions = [dimension],
): ImportTemplateIdentity {
  const columns = itemImportColumns(type, dimensions);
  return {
    format: ITEM_IMPORT_FORMAT,
    version: ITEM_IMPORT_TEMPLATE_VERSION,
    itemTypeKey: type,
    columns: columns.map((column) => column.key),
    headers: columns.map((column) => (column.required ? `${column.header} *` : column.header)),
  };
}

/** The downloaded template, filled in as an admin would, as an uploaded File. */
async function filledTemplate(
  type: ValidatedItemTypeKey,
  fill: (sheet: ExcelJS.Worksheet) => void,
  name = "questions.xlsx",
) {
  const template = await buildItemImportTemplate({} as never, type);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(template.content, "base64"));
  const sheet = workbook.getWorksheet("Questions");
  if (!sheet) throw new Error("no Questions sheet");
  fill(sheet);
  const buffer = await workbook.xlsx.writeBuffer();
  return new File([buffer], name);
}

describe("checkImportTemplate", () => {
  it("accepts the current template, with or without the required marks", () => {
    expect(checkImportTemplate(identity(), "mcq_single", [dimension]).ok).toBe(true);
    const plain = identity();
    plain.headers = itemImportColumns("mcq_single", [dimension]).map((column) => column.header);
    expect(checkImportTemplate(plain, "mcq_single", [dimension]).ok).toBe(true);
  });

  it("names the right template when the type is wrong", () => {
    const result = checkImportTemplate(identity("matching"), "mcq_single", [dimension]);
    expect(result).toMatchObject({
      ok: false,
      message: expect.stringContaining(
        "This is the Matching template, but you are importing Multiple choice (single) questions",
      ),
    });
  });

  it("refuses another file, an old version, a moved, renamed or added column", () => {
    const cases: Array<[Partial<ImportTemplateIdentity>, RegExp]> = [
      [{ format: "something-else" }, /not a question import template/],
      [{ version: "0" }, /version 0/],
    ];
    for (const [override, message] of cases) {
      const result = checkImportTemplate({ ...identity(), ...override }, "mcq_single", [dimension]);
      expect(result.ok ? "" : result.message).toMatch(message);
    }

    const renamed = identity();
    renamed.headers[2] = "Answer B";
    const renamedResult = checkImportTemplate(renamed, "mcq_single", [dimension]);
    expect(renamedResult.ok ? "" : renamedResult.message).toBe(
      'Column C of the Questions sheet should be "Option B", but it is "Answer B". Do not rename, move or delete columns: put them back or use a new template.',
    );

    const added = identity();
    added.headers.push("My notes");
    const addedResult = checkImportTemplate(added, "mcq_single", [dimension]);
    expect(addedResult.ok ? "" : addedResult.message).toMatch(/\("My notes"\) is not part/);

    const dropped = identity();
    dropped.columns = dropped.columns.filter((key) => key !== "option_h");
    expect(checkImportTemplate(dropped, "mcq_single", [dimension]).ok).toBe(false);
  });

  it("allows a dimension added since the download, refuses one that was deleted", () => {
    expect(checkImportTemplate(identity("mcq_single", []), "mcq_single", [dimension]).ok).toBe(
      true,
    );
    const result = checkImportTemplate(identity(), "mcq_single", []);
    expect(result.ok ? "" : result.message).toMatch(/dimension that no longer exists/);
  });

  it("letters columns past Z the way Excel does", () => {
    expect([0, 25, 26, 27, 51, 52].map(columnLetter)).toEqual(["A", "Z", "AA", "AB", "AZ", "BA"]);
  });
});

describe("cells on the wire", () => {
  it("carries a date as a date, so a date in a text column is still refused", () => {
    const date = new Date(Date.UTC(2026, 0, 2));
    const payload = importCellToPayload(date);
    expect(payload).toEqual({ date: "2026-01-02T00:00:00.000Z" });
    const row = importRowFromPayload({ question: payload, option_a: "1/2", weight: 0.5 });
    expect(row["question"]).toBeInstanceOf(Date);
    expect(row["option_a"]).toBe("1/2");
    expect(importCellToPayload(Number.NaN)).toBeNull();
    expect(importCellToPayload(undefined)).toBeNull();
  });
});

describe("readImportFile", () => {
  it("reads the filled-in template: identity, header and numbered rows", async () => {
    const file = await filledTemplate("mcq_single", (sheet) => {
      sheet.getRow(2).values = ["What is 1/2?", "Half", "Double", "", "", "", "", "", "", "A"];
      // Row 3 left empty: skipped, and row 4 keeps its own number.
      sheet.getRow(4).values = ["007 is a code?", "Yes", "No", "", "", "", "", "", "", "B"];
      sheet.getCell("N4").value = 0.25;
    });

    const read = await readImportFile(file);
    expect(read.identity).toEqual(identity());
    expect(read.rows.map((row) => row.rowNumber)).toEqual([2, 4]);
    expect(read.rows[0]?.cells).toMatchObject({
      question: "What is 1/2?",
      option_a: "Half",
      correct_option: "A",
    });
    expect(read.rows[1]?.cells[`weight:${dimension.id}`]).toBe(0.25);
  });

  it("refuses files that are not a template, before reading them where it can", async () => {
    await expect(readImportFile(new File(["a,b"], "questions.csv"))).rejects.toThrow(
      /Save the file as an Excel workbook/,
    );
    await expect(readImportFile(new File(["not a zip"], "questions.xlsx"))).rejects.toThrow(
      /could not be read as an Excel workbook/,
    );

    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet("Sheet1").addRow(["Question"]);
    const other = new File([await workbook.xlsx.writeBuffer()], "mine.xlsx");
    await expect(readImportFile(other)).rejects.toThrow(/not a question import template/);

    const empty = await filledTemplate("true_false", () => undefined);
    await expect(readImportFile(empty)).rejects.toBeInstanceOf(ImportFileError);
    await expect(readImportFile(empty)).rejects.toThrow(/no questions/);
  });
});

describe("sending a file", () => {
  const row = (
    rowNumber: number,
    question = `Question ${String(rowNumber)}`,
  ): ImportRowPayload => ({
    rowNumber,
    cells: { question },
  });

  it("splits rows by count and by size", () => {
    const rows = Array.from({ length: 7 }, (_, index) => row(index + 2));
    expect(chunkRows(rows, 3).map((chunk) => chunk.length)).toEqual([3, 3, 1]);

    const big = Array.from({ length: 4 }, (_, index) => row(index + 2, "x".repeat(1_000)));
    expect(chunkRows(big, 100, 2_100).map((chunk) => chunk.length)).toEqual([2, 2]);
    // A single row larger than the budget still goes, on its own.
    expect(chunkRows([row(2, "x".repeat(5_000))], 100, 1_000)).toHaveLength(1);
  });

  function fakeApi(checked: ItemImportCheckedRow[]) {
    const calls: Array<{ kind: string; key?: string; rows?: number[] }> = [];
    const api: ImportApi = {
      check: vi.fn(async (body) => {
        calls.push({ kind: "check", rows: body.rows.map((r) => r.rowNumber) });
        return {
          data: {
            rows: checked.filter((c) => body.rows.some((r) => r.rowNumber === c.rowNumber)),
          },
        };
      }),
      createBatch: vi.fn(async (body, key) => {
        calls.push({ kind: "open", key });
        return {
          data: {
            id: "batch-1",
            itemTypeKey: body.template.itemTypeKey,
            fileName: body.fileName,
            templateVersion: body.template.version,
            status: "importing" as const,
            rowsInFile: body.rowsInFile,
            rowsWithErrors: body.rowsWithErrors,
            rowsToImport: body.rowsToImport,
            importedCount: 0,
            duplicateCount: 0,
            rejectedCount: 0,
            skipDuplicates: body.skipDuplicates,
            extraTags: body.extraTags,
            createdByMembershipId: "m",
            createdAt: "",
            completedAt: null,
          },
        };
      }),
      importRows: vi.fn(async (batchId, body, key) => {
        calls.push({ kind: "rows", key, rows: body.rows.map((r) => r.rowNumber) });
        return {
          data: {
            batch: { id: batchId } as never,
            results: body.rows.map((r) => ({
              rowNumber: r.rowNumber,
              outcome: "imported" as const,
              itemId: `item-${String(r.rowNumber)}`,
              issues: [],
            })),
          },
        };
      }),
      complete: vi.fn(async (batchId, key) => {
        calls.push({ kind: "complete", key });
        return { data: { id: batchId } as never };
      }),
    };
    return { api, calls };
  }

  const checked = (
    rowNumber: number,
    status: ItemImportCheckedRow["status"],
    fingerprint: string | null,
    reference: string | null = null,
  ): ItemImportCheckedRow => ({
    rowNumber,
    status,
    issues: status === "invalid" ? [{ columns: ["question"], message: "Enter the question." }] : [],
    duplicateOf: status === "duplicate" ? { itemId: "bank-1", reason: "question" } : null,
    fingerprint,
    reference,
  });

  it("marks repeats within the file after the server's check", async () => {
    const file = {
      fileName: "q.xlsx",
      identity: identity(),
      rows: [2, 3, 4, 5, 6, 7].map((n) => row(n)),
    };
    const { api } = fakeApi([
      checked(2, "ready", "f1", "R-1"),
      checked(3, "ready", "f1"),
      checked(4, "invalid", null),
      checked(5, "ready", "f2", "R-1"),
      checked(6, "duplicate", "f3"),
      checked(7, "ready", "f3"),
    ]);

    const preview = await previewImport(file, api, () => undefined);
    expect(preview.map((r) => [r.rowNumber, r.status, r.duplicate])).toEqual([
      [2, "ready", null],
      [3, "duplicate", { in: "file", rowNumber: 2, reason: "question" }],
      [4, "invalid", null],
      [5, "duplicate", { in: "file", rowNumber: 2, reason: "reference" }],
      [6, "duplicate", { in: "bank", itemId: "bank-1", reason: "question" }],
      [7, "duplicate", { in: "file", rowNumber: 6, reason: "question" }],
    ]);
  });

  it("sends the rows to import with keys that make a retry safe", async () => {
    const file = { fileName: "q.xlsx", identity: identity(), rows: [2, 3, 4].map((n) => row(n)) };
    const preview: PreviewRow[] = [
      { rowNumber: 2, status: "ready", issues: [], duplicate: null },
      { rowNumber: 3, status: "invalid", issues: [], duplicate: null },
      {
        rowNumber: 4,
        status: "duplicate",
        issues: [],
        duplicate: { in: "file", rowNumber: 2, reason: "question" },
      },
    ];

    const skip = fakeApi([]);
    await runImport(
      file,
      preview,
      { skipDuplicates: true, extraTags: [], importKey: "k" },
      skip.api,
      () => undefined,
    );
    expect(skip.calls).toEqual([
      { kind: "open", key: "item-import-k-open" },
      { kind: "rows", key: "item-import-batch-1-rows-0", rows: [2] },
      { kind: "complete", key: "item-import-batch-1-complete" },
    ]);
    expect(skip.api.createBatch).toHaveBeenCalledWith(
      expect.objectContaining({ rowsInFile: 3, rowsWithErrors: 1, rowsToImport: 1 }),
      "item-import-k-open",
    );

    const keep = fakeApi([]);
    await runImport(
      file,
      preview,
      { skipDuplicates: false, extraTags: [], importKey: "k" },
      keep.api,
      () => undefined,
    );
    expect(keep.calls.find((c) => c.kind === "rows")?.rows).toEqual([2, 4]);
  });

  it("retries a busy server or a dropped connection, never a refusal", async () => {
    let calls = 0;
    const flaky = () => {
      calls += 1;
      if (calls === 1) return Promise.reject(Object.assign(new Error("busy"), { status: 503 }));
      if (calls === 2) return Promise.reject(new TypeError("Failed to fetch"));
      return Promise.resolve("ok");
    };
    await expect(withRetry(flaky, [0, 0, 0])).resolves.toBe("ok");
    expect(calls).toBe(3);

    let refused = 0;
    const refusal = () => {
      refused += 1;
      return Promise.reject(Object.assign(new Error("bad"), { status: 400 }));
    };
    await expect(withRetry(refusal, [0, 0, 0])).rejects.toThrow("bad");
    expect(refused).toBe(1);
  });
});

describe("itemImportBatchSummary", () => {
  const batch = (overrides: Partial<ItemImportBatch>): ItemImportBatch => ({
    id: "b",
    itemTypeKey: "mcq_single",
    fileName: "f.xlsx",
    templateVersion: "1",
    status: "completed",
    rowsInFile: 8,
    rowsWithErrors: 2,
    rowsToImport: 4,
    importedCount: 4,
    duplicateCount: 0,
    rejectedCount: 0,
    skipDuplicates: true,
    extraTags: [],
    createdByMembershipId: "m",
    createdAt: "2026-11-20T00:00:00.000Z",
    completedAt: null,
    undoneAt: null,
    ...overrides,
  });

  it("counts the duplicates the browser left out of the upload", () => {
    // Staging run, 20 Nov: 8 rows, 2 invalid, 2 repeats skipped, 4 sent.
    expect(itemImportBatchSummary(batch({}))).toEqual({
      imported: 4,
      duplicatesSkipped: 2,
      notImported: 2,
    });
  });

  it("adds the repeats the server caught and the rows it rejected", () => {
    expect(
      itemImportBatchSummary(batch({ importedCount: 2, duplicateCount: 1, rejectedCount: 1 })),
    ).toEqual({ imported: 2, duplicatesSkipped: 3, notImported: 3 });
  });

  it("counts no skipped duplicates when they were imported on purpose", () => {
    expect(
      itemImportBatchSummary(batch({ skipDuplicates: false, rowsToImport: 6, importedCount: 6 })),
    ).toEqual({ imported: 6, duplicatesSkipped: 0, notImported: 2 });
  });
});
