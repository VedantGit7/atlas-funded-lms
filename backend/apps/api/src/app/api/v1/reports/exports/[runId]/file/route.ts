import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  deleteExportRunFileResponseSchema,
  exportRunActionBodySchema,
  exportRunDetailParamsSchema,
} from "@atlas/domain/reports/export-run-detail.dto";
import { deleteExportRunFile } from "@atlas/domain/reports/export-run-detail.service";
import { deleteExportRunFileMetadata } from "@atlas/domain/reports/exports-roster.route-metadata";

export const POST = createTenantRoute<
  z.output<typeof exportRunActionBodySchema>,
  z.output<typeof deleteExportRunFileResponseSchema>,
  typeof exportRunDetailParamsSchema
>({
  metadata: deleteExportRunFileMetadata,
  params: exportRunDetailParamsSchema,
  input: exportRunActionBodySchema,
  output: deleteExportRunFileResponseSchema,
  handler: async ({ tx, ctx, params, input }) =>
    deleteExportRunFile(tx, ctx, params["runId"], input),
});
