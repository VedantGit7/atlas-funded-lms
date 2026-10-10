import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import { retryResourceUsageExportResponseSchema } from "@atlas/domain/reports/resource-usage-exports.dto";
import { retryResourceUsageExport } from "@atlas/domain/reports/resource-usage-exports.service";
import { reportExportRunParamsSchema } from "@atlas/domain/reports/report-exports.dto";
import { retryReportExportMetadata } from "@atlas/domain/reports/report-exports.route-metadata";

export const POST = createTenantRoute<
  Record<string, never>,
  z.output<typeof retryResourceUsageExportResponseSchema>,
  typeof reportExportRunParamsSchema
>({
  metadata: retryReportExportMetadata,
  params: reportExportRunParamsSchema,
  input: noBodySchema,
  output: retryResourceUsageExportResponseSchema,
  handler: async ({ tx, ctx, params }) => retryResourceUsageExport(tx, ctx, params["runId"]),
});
