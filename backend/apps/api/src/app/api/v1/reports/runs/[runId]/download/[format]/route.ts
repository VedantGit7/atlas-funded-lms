import { z } from "zod";
import type { z as Zod } from "zod";
import { createTenantRoute } from "@atlas/api";
import { AtlasHttpError } from "@atlas/core/http/errors";
import { getStorageProvider, parseStorageEnv } from "@atlas/storage";
import {
  extractSelectedColumns,
  filterDatasetByColumns,
} from "@atlas/domain/reports/reports.allowed-columns";
import { buildReportDataset } from "@atlas/domain/reports/reports.datasets";
import {
  renderReportArtifact,
  storeReportArtifact,
} from "@atlas/domain/reports/reports-export-runner";
import { getSystemReportDefinition } from "@atlas/domain/reports/reports.registry";
import { reportsRepository } from "@atlas/domain/reports/reports.repository";
import { getReportRunMetadata } from "@atlas/domain/reports/reports.route-metadata";
import { getReportRun } from "@atlas/domain/reports/reports.service";

const paramsSchema = z.object({
  runId: z.string().uuid(),
  format: z.enum(["csv", "xlsx", "pdf", "json"]),
});

const downloadResponseSchema = z.object({
  data: z.object({
    format: z.enum(["csv", "xlsx", "pdf", "json"]),
    filename: z.string(),
    contentType: z.string(),
    content: z.string(),
    contentEncoding: z.enum(["utf8", "base64"]),
    url: z.string().url().nullable(),
  }),
});

function contentTypeFor(format: "csv" | "xlsx" | "pdf" | "json"): string {
  if (format === "csv") return "text/csv; charset=utf-8";
  if (format === "xlsx") {
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  }
  if (format === "json") return "application/json; charset=utf-8";
  return "application/pdf";
}

export const GET = createTenantRoute<
  Record<string, never>,
  Zod.output<typeof downloadResponseSchema>,
  typeof paramsSchema
>({
  metadata: getReportRunMetadata,
  params: paramsSchema,
  output: downloadResponseSchema,
  handler: async ({ tx, ctx, params }) => {
    const result = await getReportRun(tx, ctx, params["runId"]);
    const run = result.data;
    const baseName = `report-${run.definitionKey}-${run.id.slice(0, 8)}`;

    if (run.format === params["format"] && result.data.download?.url) {
      return {
        data: {
          format: params["format"],
          filename: `${baseName}.${params["format"]}`,
          contentType: contentTypeFor(params["format"]),
          content: "",
          contentEncoding: "utf8" as const,
          url: result.data.download.url,
        },
      };
    }

    const row = await reportsRepository.findReportRunById(tx, params["runId"]);
    if (!row) {
      throw new AtlasHttpError({
        status: 404,
        code: "PERMISSION_DENIED",
        message: "Report run not found.",
      });
    }

    const definition = await reportsRepository.findDefinitionById(tx, row.report_definition_id);
    if (!definition) {
      throw new AtlasHttpError({
        status: 404,
        code: "PERMISSION_DENIED",
        message: "Report definition not found.",
      });
    }

    const paramsJson =
      row.params_json && typeof row.params_json === "object" && !Array.isArray(row.params_json)
        ? (row.params_json as Record<string, unknown>)
        : {};

    const dataset = await buildReportDataset(tx, {
      datasetKey: definition.dataset_key,
      params: paramsJson,
    });
    const selectedColumns = extractSelectedColumns(definition.param_schema_json);
    const filtered =
      definition.scope === "tenant" && selectedColumns.length > 0
        ? filterDatasetByColumns(dataset, selectedColumns)
        : Array.isArray(paramsJson["columns"])
          ? filterDatasetByColumns(
              dataset,
              paramsJson["columns"].filter((value): value is string => typeof value === "string"),
            )
          : dataset;

    const title = getSystemReportDefinition(definition.key)?.title ?? definition.title;
    const rendered = await renderReportArtifact(params["format"], filtered, title);

    try {
      const stored = await storeReportArtifact(ctx, {
        reportRunId: `${params["runId"]}-${params["format"]}`,
        content: rendered.content,
        contentType: rendered.contentType,
        fileExtension: rendered.fileExtension,
      });
      const env = parseStorageEnv(process.env);
      const provider = getStorageProvider();
      await provider.createSignedDownloadUrl({
        bucket: env.R2_BUCKET_NAME,
        key: stored.objectKey,
        expiresInSeconds: 60 * 15,
      });
    } catch {
      // Best-effort artifact storage; download still returns inline content.
    }

    const isBinary = params["format"] === "xlsx" || params["format"] === "pdf";
    return {
      data: {
        format: params["format"],
        filename: `${baseName}.${params["format"]}`,
        contentType: rendered.contentType,
        content: isBinary
          ? Buffer.from(rendered.content).toString("base64")
          : new TextDecoder().decode(rendered.content),
        contentEncoding: isBinary ? ("base64" as const) : ("utf8" as const),
        url: null,
      },
    };
  },
});
