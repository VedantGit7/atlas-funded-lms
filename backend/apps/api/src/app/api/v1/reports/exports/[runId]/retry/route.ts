import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  exportRunActionBodySchema,
  exportRunDetailParamsSchema,
  retryExportRunResponseSchema,
} from "@atlas/domain/reports/export-run-detail.dto";
import { retryExportRun } from "@atlas/domain/reports/export-run-detail.service";
import { retryExportRunMetadata } from "@atlas/domain/reports/exports-roster.route-metadata";

export const POST = createTenantRoute<
  z.output<typeof exportRunActionBodySchema>,
  z.output<typeof retryExportRunResponseSchema>,
  typeof exportRunDetailParamsSchema
>({
  metadata: retryExportRunMetadata,
  params: exportRunDetailParamsSchema,
  input: exportRunActionBodySchema,
  output: retryExportRunResponseSchema,
  handler: async ({ tx, ctx, params, input }) => retryExportRun(tx, ctx, params["runId"], input),
});
