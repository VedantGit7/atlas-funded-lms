import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  batchIdParamsSchema,
  batchLiveSessionsListResponseSchema,
  batchLiveSessionsQuerySchema,
} from "@atlas/domain/reports/batches-roster.dto";
import { listBatchesRosterMetadata } from "@atlas/domain/reports/batches-roster.route-metadata";
import { listBatchLiveSessions } from "@atlas/domain/reports/batches-roster.service";

export const GET = createTenantRoute<
  z.output<typeof batchLiveSessionsQuerySchema>,
  z.output<typeof batchLiveSessionsListResponseSchema>,
  typeof batchIdParamsSchema
>({
  metadata: listBatchesRosterMetadata,
  input: batchLiveSessionsQuerySchema,
  params: batchIdParamsSchema,
  output: batchLiveSessionsListResponseSchema,
  handler: async ({ tx, ctx, input, params }) =>
    listBatchLiveSessions(tx, ctx, params.batchId, input),
});
