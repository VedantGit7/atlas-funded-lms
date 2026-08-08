import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import {
  batchExportRunParamsSchema,
  retryBatchExportResponseSchema,
} from "@atlas/domain/reports/batches-exports.dto";
import { retryBatchesExportMetadata } from "@atlas/domain/reports/batches-exports.route-metadata";
import { retryBatchExport } from "@atlas/domain/reports/batches-exports.service";

export const POST = createTenantRoute<
  Record<string, never>,
  z.output<typeof retryBatchExportResponseSchema>,
  typeof batchExportRunParamsSchema
>({
  metadata: retryBatchesExportMetadata,
  params: batchExportRunParamsSchema,
  input: noBodySchema,
  output: retryBatchExportResponseSchema,
  handler: async ({ tx, ctx, params }) => retryBatchExport(tx, ctx, params["runId"]),
});
