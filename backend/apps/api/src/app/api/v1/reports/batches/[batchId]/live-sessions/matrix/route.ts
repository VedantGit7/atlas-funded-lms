import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  batchIdParamsSchema,
  batchLiveSessionsMatrixQuerySchema,
  batchLiveSessionsMatrixResponseSchema,
} from "@atlas/domain/reports/batches-roster.dto";
import { listBatchesRosterMetadata } from "@atlas/domain/reports/batches-roster.route-metadata";
import { getBatchLiveSessionsMatrix } from "@atlas/domain/reports/batches-roster.service";

export const GET = createTenantRoute<
  z.output<typeof batchLiveSessionsMatrixQuerySchema>,
  z.output<typeof batchLiveSessionsMatrixResponseSchema>,
  typeof batchIdParamsSchema
>({
  metadata: listBatchesRosterMetadata,
  input: batchLiveSessionsMatrixQuerySchema,
  params: batchIdParamsSchema,
  output: batchLiveSessionsMatrixResponseSchema,
  handler: async ({ tx, ctx, input, params }) =>
    getBatchLiveSessionsMatrix(tx, ctx, params.batchId, input),
});
