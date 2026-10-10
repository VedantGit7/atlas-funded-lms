import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import { zoomExportRunDetailResponseSchema } from "@atlas/domain/reports/zoom-insights-exports.dto";
import { getZoomExportRun } from "@atlas/domain/reports/zoom-insights-exports.service";
import { reportExportRunParamsSchema } from "@atlas/domain/reports/report-exports.dto";
import { getReportExportsMetadata } from "@atlas/domain/reports/report-exports.route-metadata";

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof zoomExportRunDetailResponseSchema>,
  typeof reportExportRunParamsSchema
>({
  metadata: getReportExportsMetadata,
  params: reportExportRunParamsSchema,
  input: noBodySchema,
  output: zoomExportRunDetailResponseSchema,
  handler: async ({ tx, ctx, params }) => getZoomExportRun(tx, ctx, params["runId"]),
});
