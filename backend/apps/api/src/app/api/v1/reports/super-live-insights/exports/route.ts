import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import {
  createSuperLiveInsightsExportBodySchema,
  createSuperLiveInsightsExportResponseSchema,
  superLiveInsightsExportsResponseSchema,
} from "@atlas/domain/reports/super-live-insights-exports.dto";
import {
  createSuperLiveInsightsExport,
  getSuperLiveInsightsExports,
} from "@atlas/domain/reports/super-live-insights-exports.service";
import {
  createReportExportMetadata,
  getReportExportsMetadata,
} from "@atlas/domain/reports/report-exports.route-metadata";

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof superLiveInsightsExportsResponseSchema>
>({
  metadata: getReportExportsMetadata,
  input: noBodySchema,
  output: superLiveInsightsExportsResponseSchema,
  handler: async ({ tx, ctx }) => getSuperLiveInsightsExports(tx, ctx),
});

export const POST = createTenantRoute<
  z.output<typeof createSuperLiveInsightsExportBodySchema>,
  z.output<typeof createSuperLiveInsightsExportResponseSchema>
>({
  metadata: createReportExportMetadata,
  body: createSuperLiveInsightsExportBodySchema,
  output: createSuperLiveInsightsExportResponseSchema,
  handler: async ({ tx, ctx, input }) => createSuperLiveInsightsExport(tx, ctx, input),
});
