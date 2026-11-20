import ExcelJS from "exceljs";

/**
 * Builds a fill-in spreadsheet template: an Instructions sheet, the sheet to
 * fill in, an Examples sheet and a hidden sheet that identifies the template.
 *
 * Write-only by design. exceljs has unpatched flaws in *reading* untrusted
 * files (an unbounded zip bomb, CVE-2026-78206, and prototype pollution
 * through cell notes, CVE-2026-78207), so uploaded spreadsheets are never
 * opened with it on the server; they are read in the browser and arrive here
 * as plain JSON rows. Writing a workbook from our own data is unaffected.
 */

export type TemplateColumnValidation =
  | { kind: "list"; values: string[] }
  | { kind: "decimal"; min: number; max: number }
  | { kind: "textLength"; max: number };

export type TemplateColumn = {
  header: string;
  required: boolean;
  /** Shown as a pop-up hint when a cell in the column is selected. */
  help: string;
  /** Characters, roughly. */
  width: number;
  format: "text" | "number";
  validation?: TemplateColumnValidation;
};

export type TemplateInstructionSection = {
  heading: string;
  lines: string[];
};

export type TemplateWorkbookSpec = {
  /** Shown at the top of the Instructions sheet. */
  title: string;
  instructions: TemplateInstructionSection[];
  /** Name of the sheet to fill in. */
  sheetName: string;
  columns: TemplateColumn[];
  /** Rows prepared with dropdowns and limits, after the header. */
  dataRows: number;
  /** Complete sample rows, in column order, on a sheet that is never imported. */
  examples: Array<Array<string | number | boolean | null>>;
  /** Written to a hidden sheet so an upload can be matched to its template. */
  meta: Record<string, string>;
};

export const TEMPLATE_META_SHEET = "_template";
export const TEMPLATE_EXAMPLES_SHEET = "Examples";
export const TEMPLATE_INSTRUCTIONS_SHEET = "Instructions";

// Excel's own limits on a data validation's hint and dropdown list.
const PROMPT_TITLE_MAX = 32;
const PROMPT_MAX = 255;
const LIST_FORMULA_MAX = 255;

const HEADER_FILL = "FF1E293B";
const HEADER_REQUIRED_FILL = "FF3730A3";
const HEADER_FONT = "FFFFFFFF";
const EXAMPLE_FILL = "FFF1F5F9";

function clip(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

function columnLetter(index: number): string {
  let n = index + 1;
  let letters = "";
  while (n > 0) {
    const remainder = (n - 1) % 26;
    letters = String.fromCharCode(65 + remainder) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters;
}

function headerText(column: TemplateColumn): string {
  return column.required ? `${column.header} *` : column.header;
}

function styleHeader(row: ExcelJS.Row, columns: TemplateColumn[]) {
  row.height = 30;
  columns.forEach((column, index) => {
    const cell = row.getCell(index + 1);
    cell.font = { bold: true, color: { argb: HEADER_FONT } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: column.required ? HEADER_REQUIRED_FILL : HEADER_FILL },
    };
    cell.alignment = { vertical: "middle", wrapText: true };
  });
}

type RangeValidations = { add(range: string, validation: ExcelJS.DataValidation): void };

/**
 * exceljs applies a validation to a whole range at runtime, but its type
 * definitions only declare the per-cell form. One rule per column range keeps
 * a 5,000-row template at about 10 KB instead of one rule per cell.
 */
function rangeValidations(sheet: ExcelJS.Worksheet): RangeValidations {
  return (sheet as unknown as { dataValidations: RangeValidations }).dataValidations;
}

function addValidation(
  sheet: ExcelJS.Worksheet,
  column: TemplateColumn,
  index: number,
  lastRow: number,
) {
  const validations = rangeValidations(sheet);
  const letter = columnLetter(index);
  const range = `${letter}2:${letter}${String(lastRow)}`;
  const prompt = {
    showInputMessage: true,
    promptTitle: clip(headerText(column), PROMPT_TITLE_MAX),
    prompt: clip(column.help, PROMPT_MAX),
  };

  const validation = column.validation;
  if (validation?.kind === "list") {
    const formula = `"${validation.values.join(",")}"`;
    if (formula.length > LIST_FORMULA_MAX) {
      throw new Error(`Dropdown values for "${column.header}" exceed Excel's limit.`);
    }
    validations.add(range, {
      type: "list",
      allowBlank: true,
      formulae: [formula],
      showErrorMessage: true,
      errorStyle: "stop",
      errorTitle: clip(column.header, PROMPT_TITLE_MAX),
      error: clip(`Choose one of: ${validation.values.join(", ")}.`, PROMPT_MAX),
      ...prompt,
    });
    return;
  }

  if (validation?.kind === "decimal") {
    validations.add(range, {
      type: "decimal",
      operator: "between",
      allowBlank: true,
      formulae: [validation.min, validation.max],
      showErrorMessage: true,
      errorStyle: "stop",
      errorTitle: clip(column.header, PROMPT_TITLE_MAX),
      error: `Enter a number from ${String(validation.min)} to ${String(validation.max)}.`,
      ...prompt,
    });
    return;
  }

  if (validation?.kind === "textLength") {
    validations.add(range, {
      type: "textLength",
      operator: "lessThanOrEqual",
      allowBlank: true,
      formulae: [validation.max],
      showErrorMessage: true,
      errorStyle: "stop",
      errorTitle: clip(column.header, PROMPT_TITLE_MAX),
      error: `Use at most ${String(validation.max)} characters.`,
      ...prompt,
    });
    return;
  }

  // Every template column has a rule; a column without one gets no hint.
}

export async function buildTemplateWorkbook(spec: TemplateWorkbookSpec): Promise<Uint8Array> {
  if (spec.columns.length === 0) throw new Error("A template needs at least one column.");

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Atlas LMS";
  workbook.created = new Date(0);
  workbook.modified = new Date(0);

  // Instructions, first so it opens first.
  const instructions = workbook.addWorksheet(TEMPLATE_INSTRUCTIONS_SHEET);
  instructions.getColumn(1).width = 110;
  const titleRow = instructions.addRow([spec.title]);
  titleRow.font = { bold: true, size: 15 };
  for (const section of spec.instructions) {
    instructions.addRow([]);
    instructions.addRow([section.heading]).font = { bold: true, size: 12 };
    for (const line of section.lines) {
      instructions.addRow([line]).alignment = { wrapText: true, vertical: "top" };
    }
  }

  // The sheet to fill in.
  const sheet = workbook.addWorksheet(spec.sheetName, {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  sheet.columns = spec.columns.map((column) => ({
    header: headerText(column),
    width: column.width,
    // Text columns are stored as text, so Excel does not turn "1/2" into a
    // date or drop leading zeros while someone types.
    style: column.format === "text" ? { numFmt: "@" } : { numFmt: "0.00" },
  }));
  styleHeader(sheet.getRow(1), spec.columns);
  const lastRow = spec.dataRows + 1;
  spec.columns.forEach((column, index) => {
    addValidation(sheet, column, index, lastRow);
  });

  // Examples: the same header, complete rows, never imported.
  const examples = workbook.addWorksheet(TEMPLATE_EXAMPLES_SHEET, {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  examples.columns = spec.columns.map((column) => ({
    header: headerText(column),
    width: column.width,
  }));
  styleHeader(examples.getRow(1), spec.columns);
  for (const values of spec.examples) {
    const row = examples.addRow(values.map((value) => value ?? ""));
    row.eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: EXAMPLE_FILL } };
      cell.alignment = { wrapText: true, vertical: "top" };
    });
  }

  // Identifies the template, so an upload into the wrong type, or from an
  // old version, is refused with a clear message.
  const meta = workbook.addWorksheet(TEMPLATE_META_SHEET, { state: "veryHidden" });
  for (const [key, value] of Object.entries(spec.meta)) {
    meta.addRow([key, value]);
  }

  // The fill-in sheet opens first after the instructions are read once.
  workbook.views = [
    {
      x: 0,
      y: 0,
      width: 20_000,
      height: 15_000,
      firstSheet: 0,
      activeTab: 1,
      visibility: "visible",
    },
  ];

  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer);
}
