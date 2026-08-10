import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import {
  createZoomExportBodySchema,
  createZoomExportResponseSchema,
  zoomInsightsExportsResponseSchema,
} from "@atlas/domain/reports/zoom-insights-exports.dto";
import {
  createZoomInsightsExportMetadata,
  getZoomInsightsExportsMetadata,
} from "@atlas/domain/reports/zoom-insights-exports.route-metadata";
import {
  createZoomExport,
  getZoomInsightsExports,
} from "@atlas/domain/reports/zoom-insights-exports.service";

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof zoomInsightsExportsResponseSchema>
>({
  metadata: getZoomInsightsExportsMetadata,
  input: noBodySchema,
  output: zoomInsightsExportsResponseSchema,
  handler: async ({ tx, ctx }) => getZoomInsightsExports(tx, ctx),
});

export const POST = createTenantRoute<
  z.output<typeof createZoomExportBodySchema>,
  z.output<typeof createZoomExportResponseSchema>
>({
  metadata: createZoomInsightsExportMetadata,
  body: createZoomExportBodySchema,
  output: createZoomExportResponseSchema,
  handler: async ({ tx, ctx, input }) => createZoomExport(tx, ctx, input),
});
