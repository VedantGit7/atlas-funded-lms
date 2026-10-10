import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import { retryZoomExportResponseSchema } from "@atlas/domain/reports/zoom-insights-exports.dto";
import { retryZoomExport } from "@atlas/domain/reports/zoom-insights-exports.service";
import { reportExportRunParamsSchema } from "@atlas/domain/reports/report-exports.dto";
import { retryReportExportMetadata } from "@atlas/domain/reports/report-exports.route-metadata";

export const POST = createTenantRoute<
  Record<string, never>,
  z.output<typeof retryZoomExportResponseSchema>,
  typeof reportExportRunParamsSchema
>({
  metadata: retryReportExportMetadata,
  params: reportExportRunParamsSchema,
  input: noBodySchema,
  output: retryZoomExportResponseSchema,
  handler: async ({ tx, ctx, params }) => retryZoomExport(tx, ctx, params["runId"]),
});
