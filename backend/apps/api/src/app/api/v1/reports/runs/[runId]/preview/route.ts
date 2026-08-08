import { z } from "zod";
import type { z as Zod } from "zod";
import { createTenantRoute } from "@atlas/api";
import { buildReportDataset } from "@atlas/domain/reports/reports.datasets";
import { extractSelectedColumns, filterDatasetByColumns } from "@atlas/domain/reports/reports.allowed-columns";
import { reportsRepository } from "@atlas/domain/reports/reports.repository";
import { getReportRun } from "@atlas/domain/reports/reports.service";
import { getReportRunMetadata } from "@atlas/domain/reports/reports.route-metadata";
import { reportPreviewResponseSchema } from "../../../../../../server/reports/reports.schemas";

const paramsSchema = z.object({ runId: z.string().uuid() });

export const GET = createTenantRoute<
  Record<string, never>,
  Zod.output<typeof reportPreviewResponseSchema>,
  typeof paramsSchema
>({
  metadata: getReportRunMetadata,
  params: paramsSchema,
  output: reportPreviewResponseSchema,
  handler: async ({ tx, ctx, params }) => {
    const result = await getReportRun(tx, ctx, params.runId);
    const run = result.data;

    const definition = await reportsRepository.findDefinitionByKey(tx, run.definitionKey);
    if (!definition) {
      return {
        data: {
          runId: run.id,
          defaultViz: "table",
          preview: { columns: [], rows: [] },
        },
      };
    }

    const paramsJson =
      run.params && typeof run.params === "object" && !Array.isArray(run.params)
        ? (run.params as Record<string, unknown>)
        : {};

    const dataset = await buildReportDataset(tx, {
      datasetKey: definition.dataset_key,
      params: paramsJson,
    });

    const selectedColumns = extractSelectedColumns(definition.param_schema_json);
    const previewDataset =
      definition.scope === "tenant" && selectedColumns.length > 0
        ? filterDatasetByColumns(dataset, selectedColumns)
        : dataset;

    return {
      data: {
        runId: run.id,
        defaultViz: "table",
        preview: {
          columns: previewDataset.columns.map((column) => ({
            key: column,
            label: column,
            kind: "string" as const,
          })),
          rows: previewDataset.rows.map((row) => {
            const mapped: Record<string, string | number | null> = {};
            for (const column of previewDataset.columns) {
              const value = row[column];
              if (value == null) {
                mapped[column] = null;
              } else if (typeof value === "number") {
                mapped[column] = value;
              } else if (typeof value === "string") {
                mapped[column] = value;
              } else {
                mapped[column] = JSON.stringify(value);
              }
            }
            return mapped;
          }),
          dimensions: previewDataset.columns.slice(0, 1),
          measures: previewDataset.columns.slice(1),
        },
      },
    };
  },
});
