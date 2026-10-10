import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import { resourceUsageExportRunDetailResponseSchema } from "@atlas/domain/reports/resource-usage-exports.dto";
import { getResourceUsageExportRun } from "@atlas/domain/reports/resource-usage-exports.service";
import { reportExportRunParamsSchema } from "@atlas/domain/reports/report-exports.dto";
import { getReportExportsMetadata } from "@atlas/domain/reports/report-exports.route-metadata";

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof resourceUsageExportRunDetailResponseSchema>,
  typeof reportExportRunParamsSchema
>({
  metadata: getReportExportsMetadata,
  params: reportExportRunParamsSchema,
  input: noBodySchema,
  output: resourceUsageExportRunDetailResponseSchema,
  handler: async ({ tx, ctx, params }) => getResourceUsageExportRun(tx, ctx, params["runId"]),
});
