import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  cancelExportRunResponseSchema,
  exportRunActionBodySchema,
  exportRunDetailParamsSchema,
} from "@atlas/domain/reports/export-run-detail.dto";
import { cancelExportRun } from "@atlas/domain/reports/export-run-detail.service";
import { cancelExportRunMetadata } from "@atlas/domain/reports/exports-roster.route-metadata";

export const POST = createTenantRoute<
  z.output<typeof exportRunActionBodySchema>,
  z.output<typeof cancelExportRunResponseSchema>,
  typeof exportRunDetailParamsSchema
>({
  metadata: cancelExportRunMetadata,
  params: exportRunDetailParamsSchema,
  input: exportRunActionBodySchema,
  output: cancelExportRunResponseSchema,
  handler: async ({ tx, ctx, params, input }) => cancelExportRun(tx, ctx, params["runId"], input),
});
