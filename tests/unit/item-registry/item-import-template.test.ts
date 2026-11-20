import ExcelJS from "../../../backend/packages/domain/node_modules/exceljs";
import { describe, expect, it, vi } from "vitest";
import { VALIDATED_ITEM_TYPES } from "../../../backend/apps/api/src/server/item-registry/item-definition.contract";
import {
  ITEM_IMPORT_FORMAT,
  ITEM_IMPORT_MAX_ROWS,
  ITEM_IMPORT_TEMPLATE_VERSION,
  itemImportColumns,
} from "../../../backend/apps/api/src/server/item-registry/item-import.contract";

/**
 * The downloaded template, opened the way Excel would open it. These read
 * back our own generated workbook (trusted), never an upload.
 */

const dimensions = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    key: "risk",
    name: "Risk",
    description: null,
    createdAt: "",
    updatedAt: "",
  },
];

vi.mock("../../../backend/apps/api/src/server/competency/competency-config.repository", () => ({
  listDimensions: vi.fn(async () => dimensions),
}));

const { buildItemImportTemplate } =
  await import("../../../backend/apps/api/src/server/item-registry/item-import-template.service");

async function open(type: (typeof VALIDATED_ITEM_TYPES)[number]) {
  const template = await buildItemImportTemplate({} as never, type);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(template.content, "base64"));
  return { template, workbook };
}

describe("question import template", () => {
  it.each(VALIDATED_ITEM_TYPES)(
    "%s opens with instructions, questions, examples and its identity",
    async (type) => {
      const { template, workbook } = await open(type);

      expect(template.filename).toBe(
        `questions-${type.replace(/_/g, "-")}-template-v${ITEM_IMPORT_TEMPLATE_VERSION}.xlsx`,
      );
      expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
        "Instructions",
        "Questions",
        "Examples",
        "_template",
      ]);

      const columns = itemImportColumns(type, dimensions);
      const questions = workbook.getWorksheet("Questions");
      const header = (questions?.getRow(1).values as unknown[]).slice(1);
      expect(header).toEqual(
        columns.map((column) => (column.required ? `${column.header} *` : column.header)),
      );
      expect(questions?.views[0]).toMatchObject({ state: "frozen", ySplit: 1 });

      const meta = workbook.getWorksheet("_template");
      expect(meta?.state).toBe("veryHidden");
      const values = Object.fromEntries(
        (meta?.getSheetValues() ?? []).slice(1).map((row) => {
          const cells = row as unknown[];
          return [String(cells[1]), String(cells[2])];
        }),
      );
      expect(values).toEqual({
        format: ITEM_IMPORT_FORMAT,
        version: ITEM_IMPORT_TEMPLATE_VERSION,
        itemTypeKey: type,
        columns: columns.map((column) => column.key).join(","),
      });

      const examples = workbook.getWorksheet("Examples");
      expect((examples?.rowCount ?? 0) - 1).toBeGreaterThan(0);
    },
  );

  it("prepares every question row with the column's dropdown and hint", async () => {
    const { workbook } = await open("mcq_single");
    const questions = workbook.getWorksheet("Questions");
    const columns = itemImportColumns("mcq_single", dimensions);
    const correctIndex = columns.findIndex((column) => column.key === "correct_option");
    const weightIndex = columns.findIndex((column) => column.key.startsWith("weight:"));
    const letter = (index: number) => String.fromCharCode(65 + index);

    const lastRow = ITEM_IMPORT_MAX_ROWS + 1;
    for (const row of [2, lastRow]) {
      expect(
        questions?.getCell(`${letter(correctIndex)}${String(row)}`).dataValidation,
      ).toMatchObject({ type: "list", formulae: ['"A,B,C,D,E,F,G,H"'], showInputMessage: true });
      expect(
        questions?.getCell(`${letter(weightIndex)}${String(row)}`).dataValidation,
      ).toMatchObject({ type: "decimal", operator: "between", formulae: [0, 1] });
    }
    expect(
      questions?.getCell(`${letter(correctIndex)}${String(lastRow + 1)}`).dataValidation,
    ).toBeUndefined();
  });

  it("stores text columns as text, so Excel keeps 1/2 and 007 as typed", async () => {
    const { workbook } = await open("fill_blank");
    const questions = workbook.getWorksheet("Questions");
    expect(questions?.getColumn(1).numFmt).toBe("@");
    expect(questions?.getColumn(2).numFmt).toBe("@");
  });
});
