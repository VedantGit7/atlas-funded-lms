import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  batchExamsListResponseSchema,
  batchExamsQuerySchema,
  batchIdParamsSchema,
} from "@atlas/domain/reports/batches-roster.dto";
import { listBatchesRosterMetadata } from "@atlas/domain/reports/batches-roster.route-metadata";
import { listBatchExams } from "@atlas/domain/reports/batches-roster.service";

export const GET = createTenantRoute<
  z.output<typeof batchExamsQuerySchema>,
  z.output<typeof batchExamsListResponseSchema>,
  typeof batchIdParamsSchema
>({
  metadata: listBatchesRosterMetadata,
  input: batchExamsQuerySchema,
  params: batchIdParamsSchema,
  output: batchExamsListResponseSchema,
  handler: async ({ tx, ctx, input, params }) =>
    listBatchExams(tx, ctx, params.batchId, input),
});
