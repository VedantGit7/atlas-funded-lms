import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  exportRunDetailParamsSchema,
  exportRunDetailQuerySchema,
  exportRunDetailResponseSchema,
} from "@atlas/domain/reports/export-run-detail.dto";
import { getExportRunDetail } from "@atlas/domain/reports/export-run-detail.service";
import { getExportRunDetailMetadata } from "@atlas/domain/reports/exports-roster.route-metadata";

export const GET = createTenantRoute<
  z.output<typeof exportRunDetailQuerySchema>,
  z.output<typeof exportRunDetailResponseSchema>,
  typeof exportRunDetailParamsSchema
>({
  metadata: getExportRunDetailMetadata,
  params: exportRunDetailParamsSchema,
  input: exportRunDetailQuerySchema,
  output: exportRunDetailResponseSchema,
  handler: async ({ tx, ctx, params, input }) =>
    getExportRunDetail(tx, ctx, params["runId"], input),
});
