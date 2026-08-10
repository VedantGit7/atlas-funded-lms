import type { TenantTx } from "@atlas/db";
import type { ServiceCtx } from "../shared/domain.types";
import { REPORT_ROW_CAP } from "./reports.contract";
import {
  exportBuilderPreviewBodySchema,
  exportBuilderPreviewResponseSchema,
  type ExportBuilderPreviewBody,
} from "./export-builder.dto";
import { filterDatasetByColumns } from "./reports.allowed-columns";
import { buildReportDataset } from "./reports.datasets";
import { reportDefinitionNotFound } from "./reports.errors";
import { ensureTenantReportDefinitions } from "./reports.service";
import { reportsRepository } from "./reports.repository";

const PII_COLUMN_HINTS = [
  "email",
  "phone",
  "mobile",
  "address",
  "billing",
  "ip",
  "name",
  "learner_name",
  "display_name",
  "first_name",
  "last_name",
];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${String(bytes)} B`;
  if (bytes < 1024 * 1024) return `${String(Math.max(1, Math.round(bytes / 1024)))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function estimateSizeLabel(rowCount: number, format: string | undefined): string {
  const perRow = format === "xlsx" ? 120 : format === "json" ? 180 : 64;
  return `~${formatBytes(Math.max(rowCount, 1) * perRow)}`;
}

function isPiiColumn(column: string): boolean {
  const lower = column.toLowerCase();
  return PII_COLUMN_HINTS.some((hint) => lower.includes(hint));
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

export async function previewExportBuilder(tx: TenantTx, ctx: ServiceCtx, rawBody: unknown) {
  void ctx;
  const body: ExportBuilderPreviewBody = exportBuilderPreviewBodySchema.parse(rawBody);
  await ensureTenantReportDefinitions(tx);

  const definition = await reportsRepository.findDefinitionByKey(tx, body.definitionKey);
  if (!definition) {
    throw reportDefinitionNotFound();
  }

  const params = asRecord(body.params);
  if (body.rowLimit != null) {
    params["rowLimit"] = body.rowLimit;
  }
  if (body.columns && body.columns.length > 0) {
    params["columns"] = body.columns;
  }

  let dataset = await buildReportDataset(tx, {
    datasetKey: definition.dataset_key,
    params,
  });

  if (body.columns && body.columns.length > 0) {
    dataset = filterDatasetByColumns(dataset, body.columns);
  }

  if (typeof body.rowLimit === "number" && body.rowLimit > 0) {
    dataset = {
      columns: dataset.columns,
      rows: dataset.rows.slice(0, body.rowLimit),
    };
  }

  const estimatedRowCount = dataset.rows.length;
  const capped = estimatedRowCount >= REPORT_ROW_CAP;
  const sampleRows = dataset.rows.slice(0, body.sampleLimit).map((row) => {
    const mapped: Record<string, unknown> = {};
    for (const column of dataset.columns) {
      const value = row[column];
      if (
        value == null ||
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean"
      ) {
        mapped[column] = value ?? null;
      } else if (value instanceof Date) {
        mapped[column] = value.toISOString();
      } else {
        mapped[column] =
          typeof value === "string" || typeof value === "number" || typeof value === "boolean"
            ? String(value)
            : "";
      }
    }
    return mapped;
  });

  return exportBuilderPreviewResponseSchema.parse({
    data: {
      definitionKey: definition.key,
      definitionTitle: definition.title,
      datasetKey: definition.dataset_key,
      estimatedRowCount,
      capped,
      rowCap: REPORT_ROW_CAP,
      estimatedSizeLabel: estimateSizeLabel(estimatedRowCount, body.format),
      columns: dataset.columns,
      piiColumns: dataset.columns.filter(isPiiColumn),
      sampleRows,
      sampleLimit: body.sampleLimit,
    },
  });
}
