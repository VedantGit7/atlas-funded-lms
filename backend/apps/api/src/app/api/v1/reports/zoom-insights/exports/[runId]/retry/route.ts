import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import {
  retryZoomExportResponseSchema,
  zoomExportRunParamsSchema,
} from "@atlas/domain/reports/zoom-insights-exports.dto";
import { retryZoomInsightsExportMetadata } from "@atlas/domain/reports/zoom-insights-exports.route-metadata";
import { retryZoomExport } from "@atlas/domain/reports/zoom-insights-exports.service";

export const POST = createTenantRoute<
  Record<string, never>,
  z.output<typeof retryZoomExportResponseSchema>,
  typeof zoomExportRunParamsSchema
>({
  metadata: retryZoomInsightsExportMetadata,
  params: zoomExportRunParamsSchema,
  input: noBodySchema,
  output: retryZoomExportResponseSchema,
  handler: async ({ tx, ctx, params }) => retryZoomExport(tx, ctx, params["runId"]),
});
