import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import {
  zoomExportRunDetailResponseSchema,
  zoomExportRunParamsSchema,
} from "@atlas/domain/reports/zoom-insights-exports.dto";
import { getZoomInsightsExportsMetadata } from "@atlas/domain/reports/zoom-insights-exports.route-metadata";
import { getZoomExportRun } from "@atlas/domain/reports/zoom-insights-exports.service";

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof zoomExportRunDetailResponseSchema>,
  typeof zoomExportRunParamsSchema
>({
  metadata: getZoomInsightsExportsMetadata,
  params: zoomExportRunParamsSchema,
  input: noBodySchema,
  output: zoomExportRunDetailResponseSchema,
  handler: async ({ tx, ctx, params }) => getZoomExportRun(tx, ctx, params["runId"]),
});
