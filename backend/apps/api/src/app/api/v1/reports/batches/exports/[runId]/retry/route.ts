import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import { retryBatchExportResponseSchema } from "@atlas/domain/reports/batches-exports.dto";
import { retryBatchExport } from "@atlas/domain/reports/batches-exports.service";
import { reportExportRunParamsSchema } from "@atlas/domain/reports/report-exports.dto";
import { retryReportExportMetadata } from "@atlas/domain/reports/report-exports.route-metadata";

export const POST = createTenantRoute<
  Record<string, never>,
  z.output<typeof retryBatchExportResponseSchema>,
  typeof reportExportRunParamsSchema
>({
  metadata: retryReportExportMetadata,
  params: reportExportRunParamsSchema,
  input: noBodySchema,
  output: retryBatchExportResponseSchema,
  handler: async ({ tx, ctx, params }) => retryBatchExport(tx, ctx, params["runId"]),
});
