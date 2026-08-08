import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  batchContentLearnersQuerySchema,
  batchContentLearnersResponseSchema,
  batchIdParamsSchema,
} from "@atlas/domain/reports/batches-roster.dto";
import { listBatchesRosterMetadata } from "@atlas/domain/reports/batches-roster.route-metadata";
import { listBatchContentLearners } from "@atlas/domain/reports/batches-roster.service";

export const GET = createTenantRoute<
  z.output<typeof batchContentLearnersQuerySchema>,
  z.output<typeof batchContentLearnersResponseSchema>,
  typeof batchIdParamsSchema
>({
  metadata: listBatchesRosterMetadata,
  input: batchContentLearnersQuerySchema,
  params: batchIdParamsSchema,
  output: batchContentLearnersResponseSchema,
  handler: async ({ tx, ctx, input, params }) =>
    listBatchContentLearners(tx, ctx, params.batchId, input),
});
