import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import {
  createZoomExportBodySchema,
  createZoomExportResponseSchema,
  zoomInsightsExportsResponseSchema,
} from "@atlas/domain/reports/zoom-insights-exports.dto";
import {
  createZoomExport,
  getZoomInsightsExports,
} from "@atlas/domain/reports/zoom-insights-exports.service";
import {
  createReportExportMetadata,
  getReportExportsMetadata,
} from "@atlas/domain/reports/report-exports.route-metadata";

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof zoomInsightsExportsResponseSchema>
>({
  metadata: getReportExportsMetadata,
  input: noBodySchema,
  output: zoomInsightsExportsResponseSchema,
  handler: async ({ tx, ctx }) => getZoomInsightsExports(tx, ctx),
});

export const POST = createTenantRoute<
  z.output<typeof createZoomExportBodySchema>,
  z.output<typeof createZoomExportResponseSchema>
>({
  metadata: createReportExportMetadata,
  body: createZoomExportBodySchema,
  output: createZoomExportResponseSchema,
  handler: async ({ tx, ctx, input }) => createZoomExport(tx, ctx, input),
});
