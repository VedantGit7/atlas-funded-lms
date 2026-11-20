import type { TenantTx } from "@atlas/db";
import { buildTemplateWorkbook } from "@atlas/domain/spreadsheets/template-workbook";
import { listDimensions } from "../competency/competency-config.repository";
import type { ValidatedItemTypeKey } from "./item-definition.contract";
import {
  ITEM_IMPORT_FORMAT,
  ITEM_IMPORT_MAX_ROWS,
  ITEM_IMPORT_TEMPLATE_VERSION,
  ITEM_IMPORT_TYPE_NAMES,
  itemImportColumns,
  itemImportExamples,
  itemImportInstructions,
} from "./item-import.contract";

export const XLSX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/**
 * The question-import template for one item type, built for this academy:
 * its competency dimensions become weight columns. Returned as base64, like
 * the report downloads, because API routes answer in JSON.
 */
export async function buildItemImportTemplate(tx: TenantTx, type: ValidatedItemTypeKey) {
  const dimensions = (await listDimensions({ tx })).map((dimension) => ({
    id: dimension.id,
    name: dimension.name,
  }));
  const columns = itemImportColumns(type, dimensions);
  const name = ITEM_IMPORT_TYPE_NAMES[type];

  const content = await buildTemplateWorkbook({
    title: `Question import template: ${name}`,
    instructions: [{ heading: "How to fill it in", lines: itemImportInstructions(type) }],
    sheetName: "Questions",
    columns: columns.map((column) => ({
      header: column.header,
      required: column.required,
      help: column.help,
      width: column.width,
      format: column.format,
      ...(column.validation ? { validation: column.validation } : {}),
    })),
    dataRows: ITEM_IMPORT_MAX_ROWS,
    examples: itemImportExamples(type).map((row) =>
      columns.map((column) => {
        const value = row[column.key];
        return value instanceof Date || value === undefined ? null : value;
      }),
    ),
    meta: {
      format: ITEM_IMPORT_FORMAT,
      version: ITEM_IMPORT_TEMPLATE_VERSION,
      itemTypeKey: type,
      columns: columns.map((column) => column.key).join(","),
    },
  });

  return {
    filename: `questions-${type.replace(/_/g, "-")}-template-v${ITEM_IMPORT_TEMPLATE_VERSION}.xlsx`,
    contentType: XLSX_CONTENT_TYPE,
    content: Buffer.from(content).toString("base64"),
    templateVersion: ITEM_IMPORT_TEMPLATE_VERSION,
  };
}
