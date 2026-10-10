import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import { smExportRunDetailResponseSchema } from "@atlas/domain/reports/sales-marketing-exports.dto";
import { getSalesMarketingExportRun } from "@atlas/domain/reports/sales-marketing-exports.service";
import { reportExportRunParamsSchema } from "@atlas/domain/reports/report-exports.dto";
import { getReportExportsMetadata } from "@atlas/domain/reports/report-exports.route-metadata";

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof smExportRunDetailResponseSchema>,
  typeof reportExportRunParamsSchema
>({
  metadata: getReportExportsMetadata,
  params: reportExportRunParamsSchema,
  input: noBodySchema,
  output: smExportRunDetailResponseSchema,
  handler: async ({ tx, ctx, params }) => getSalesMarketingExportRun(tx, ctx, params["runId"]),
});
