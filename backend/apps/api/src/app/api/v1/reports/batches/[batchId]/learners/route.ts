import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  batchIdParamsSchema,
  batchLearnersListResponseSchema,
  batchLearnersQuerySchema,
} from "@atlas/domain/reports/batches-roster.dto";
import { listBatchesRosterMetadata } from "@atlas/domain/reports/batches-roster.route-metadata";
import { listBatchLearners } from "@atlas/domain/reports/batches-roster.service";

export const GET = createTenantRoute<
  z.output<typeof batchLearnersQuerySchema>,
  z.output<typeof batchLearnersListResponseSchema>,
  typeof batchIdParamsSchema
>({
  metadata: listBatchesRosterMetadata,
  input: batchLearnersQuerySchema,
  params: batchIdParamsSchema,
  output: batchLearnersListResponseSchema,
  handler: async ({ tx, ctx, input, params }) =>
    listBatchLearners(tx, ctx, params.batchId, input),
});
