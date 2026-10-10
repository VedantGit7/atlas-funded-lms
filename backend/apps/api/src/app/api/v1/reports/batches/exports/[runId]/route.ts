import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import { batchExportRunDetailResponseSchema } from "@atlas/domain/reports/batches-exports.dto";
import { getBatchExportRun } from "@atlas/domain/reports/batches-exports.service";
import { reportExportRunParamsSchema } from "@atlas/domain/reports/report-exports.dto";
import { getReportExportsMetadata } from "@atlas/domain/reports/report-exports.route-metadata";

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof batchExportRunDetailResponseSchema>,
  typeof reportExportRunParamsSchema
>({
  metadata: getReportExportsMetadata,
  params: reportExportRunParamsSchema,
  input: noBodySchema,
  output: batchExportRunDetailResponseSchema,
  handler: async ({ tx, ctx, params }) => getBatchExportRun(tx, ctx, params["runId"]),
});
