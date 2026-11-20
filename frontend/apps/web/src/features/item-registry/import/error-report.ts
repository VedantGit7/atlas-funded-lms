import writeXlsxFile, { type Row } from "write-excel-file/browser";
import type { ImportCellPayload } from "@atlas/contracts/item-registry/item-import-api.contract";
import type { ImportFile } from "./read-import-file";
import type { PreviewRow } from "./run-import";

/**
 * A workbook of the rows that will not be imported, each with what is wrong,
 * followed by the row as it was in the file. Fix them in the original file
 * and upload it again.
 *
 * Every value is written as a text, number or date cell, never as a formula,
 * so a cell that starts with "=" cannot run when the report is opened
 * (OWASP CSV injection).
 */

function cellValue(value: ImportCellPayload | undefined): string | number | Date | boolean | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "object") {
    const date = new Date(value.date);
    return Number.isNaN(date.getTime()) ? value.date : date;
  }
  return value;
}

function problemText(row: PreviewRow): string {
  if (row.status === "invalid") return row.issues.map((issue) => issue.message).join("\n");
  if (row.duplicate?.in === "file") {
    return row.duplicate.reason === "question"
      ? `The same question as row ${String(row.duplicate.rowNumber)}.`
      : `The same reference as row ${String(row.duplicate.rowNumber)}.`;
  }
  if (row.duplicate?.in === "bank") {
    return row.duplicate.reason === "question"
      ? "This question is already in the item bank."
      : "A question with this reference is already in the item bank.";
  }
  return "";
}

export async function downloadErrorReport(file: ImportFile, preview: PreviewRow[]) {
  const problems = preview.filter((row) => row.status !== "ready");
  const byRow = new Map(file.rows.map((row) => [row.rowNumber, row]));
  const header: Row = [
    { value: "Row", fontWeight: "bold" },
    { value: "Status", fontWeight: "bold" },
    { value: "What to fix", fontWeight: "bold" },
    ...file.identity.headers
      .slice(0, file.identity.columns.length)
      .map((value) => ({ value, fontWeight: "bold" as const })),
  ];
  const data: Row[] = [
    header,
    ...problems.map((row): Row => {
      const source = byRow.get(row.rowNumber);
      return [
        { value: row.rowNumber, type: Number },
        { value: row.status === "invalid" ? "Error" : "Duplicate", type: String },
        { value: problemText(row), type: String, wrap: true },
        ...file.identity.columns.map((key) => {
          const value = cellValue(source?.cells[key]);
          if (value === null) return null;
          if (value instanceof Date) return { value, type: Date, format: "yyyy-mm-dd" };
          if (typeof value === "number") return { value, type: Number };
          if (typeof value === "boolean") return { value, type: Boolean };
          return { value, type: String };
        }),
      ];
    }),
  ];

  const base = file.fileName.replace(/\.xlsx$/i, "");
  await writeXlsxFile(data, {
    sheet: "Rows to fix",
    stickyRowsCount: 1,
    columns: [
      { width: 8 },
      { width: 12 },
      { width: 60 },
      ...file.identity.columns.map(() => ({ width: 24 })),
    ],
  }).toFile(`${base}-rows-to-fix.xlsx`);
}
