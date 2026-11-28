import readXlsxFile from "read-excel-file/browser";
import {
  ITEM_IMPORT_FILE_MAX_BYTES,
  importCellToPayload,
  type ImportRowPayload,
  type ImportTemplateIdentity,
} from "@atlas/contracts/item-registry/item-import-api.contract";
import {
  ITEM_IMPORT_MAX_ROWS,
  isBlankImportRow,
  isImportTemplateType,
  type ImportRow,
} from "@atlas/contracts/item-registry/item-import.contract";

/**
 * Reads a filled-in question template in the browser. The server never opens
 * an uploaded spreadsheet (exceljs has unpatched flaws in reading untrusted
 * files); it receives the rows read here as JSON and checks them itself.
 */

export type ImportFile = {
  fileName: string;
  identity: ImportTemplateIdentity;
  /** Rows with anything in them, numbered as on the Questions sheet. */
  rows: ImportRowPayload[];
};

export class ImportFileError extends Error {
  override name = "ImportFileError";
}

const NOT_A_TEMPLATE =
  "This file is not a question import template. Download the template for your question type from this page, fill it in and upload it here.";

function text(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

export async function readImportFile(file: File): Promise<ImportFile> {
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".xls") || lower.endsWith(".csv") || lower.endsWith(".xlsm")) {
    throw new ImportFileError(
      "Save the file as an Excel workbook (.xlsx) and upload it again. Older .xls, macro-enabled .xlsm and .csv files are not accepted.",
    );
  }
  if (!lower.endsWith(".xlsx")) throw new ImportFileError(NOT_A_TEMPLATE);
  if (file.size > ITEM_IMPORT_FILE_MAX_BYTES) {
    throw new ImportFileError(
      `This file is ${(file.size / 1024 / 1024).toFixed(1)} MB. Files of up to ${String(ITEM_IMPORT_FILE_MAX_BYTES / 1024 / 1024)} MB are accepted; split the questions into two files.`,
    );
  }

  let sheets: Awaited<ReturnType<typeof readXlsxFile>>;
  try {
    sheets = await readXlsxFile(file);
  } catch {
    throw new ImportFileError(
      "This file could not be read as an Excel workbook. Open it in Excel, save it as .xlsx and upload it again.",
    );
  }

  const meta = sheets.find((sheet) => sheet.sheet === "_template");
  const questions = sheets.find((sheet) => sheet.sheet === "Questions");
  if (!meta || !questions) throw new ImportFileError(NOT_A_TEMPLATE);

  const values = new Map(meta.data.map((row) => [text(row[0]), text(row[1])]));
  const itemTypeKey = values.get("itemTypeKey") ?? "";
  if (!isImportTemplateType(itemTypeKey)) throw new ImportFileError(NOT_A_TEMPLATE);
  const columns = (values.get("columns") ?? "").split(",").filter(Boolean);

  const [headerRow = [], ...body] = questions.data;
  const identity: ImportTemplateIdentity = {
    format: values.get("format") ?? "",
    version: values.get("version") ?? "",
    itemTypeKey,
    columns,
    headers: headerRow.map(text),
  };

  const rows: ImportRowPayload[] = [];
  body.forEach((cells, index) => {
    const row: ImportRow = {};
    columns.forEach((key, column) => {
      const value: unknown = cells[column];
      row[key] = value === null || value === undefined ? null : (value as ImportRow[string]);
    });
    if (isBlankImportRow(row)) return;
    rows.push({
      rowNumber: index + 2,
      cells: Object.fromEntries(
        Object.entries(row).map(([key, value]) => [key, importCellToPayload(value)]),
      ),
    });
  });

  if (rows.length === 0) {
    throw new ImportFileError(
      "The Questions sheet has no questions. Add one question per row, starting on row 2.",
    );
  }
  const lastRow = ITEM_IMPORT_MAX_ROWS + 1;
  const outside = rows.find((row) => row.rowNumber > lastRow);
  if (rows.length <= ITEM_IMPORT_MAX_ROWS && outside) {
    throw new ImportFileError(
      `Row ${outside.rowNumber.toLocaleString("en")} is below the last question row. Keep questions in rows 2 to ${lastRow.toLocaleString("en")}, with no long gaps.`,
    );
  }
  if (rows.length > ITEM_IMPORT_MAX_ROWS) {
    throw new ImportFileError(
      `This file has ${rows.length.toLocaleString("en")} questions. Up to ${ITEM_IMPORT_MAX_ROWS.toLocaleString("en")} can be imported at once; split them into two files.`,
    );
  }

  return { fileName: file.name, identity, rows };
}
