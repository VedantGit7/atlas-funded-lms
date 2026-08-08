import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  batchExamsMatrixQuerySchema,
  batchExamsMatrixResponseSchema,
  batchIdParamsSchema,
} from "@atlas/domain/reports/batches-roster.dto";
import { listBatchesRosterMetadata } from "@atlas/domain/reports/batches-roster.route-metadata";
import { getBatchExamsMatrix } from "@atlas/domain/reports/batches-roster.service";

export const GET = createTenantRoute<
  z.output<typeof batchExamsMatrixQuerySchema>,
  z.output<typeof batchExamsMatrixResponseSchema>,
  typeof batchIdParamsSchema
>({
  metadata: listBatchesRosterMetadata,
  input: batchExamsMatrixQuerySchema,
  params: batchIdParamsSchema,
  output: batchExamsMatrixResponseSchema,
  handler: async ({ tx, ctx, input, params }) =>
    getBatchExamsMatrix(tx, ctx, params.batchId, input),
});
