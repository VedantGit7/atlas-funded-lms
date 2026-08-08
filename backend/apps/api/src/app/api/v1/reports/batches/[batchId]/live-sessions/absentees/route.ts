import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  batchIdParamsSchema,
  batchLiveSessionsAbsenteesQuerySchema,
  batchLiveSessionsAbsenteesResponseSchema,
} from "@atlas/domain/reports/batches-roster.dto";
import { listBatchesRosterMetadata } from "@atlas/domain/reports/batches-roster.route-metadata";
import { listBatchLiveSessionAbsentees } from "@atlas/domain/reports/batches-roster.service";

export const GET = createTenantRoute<
  z.output<typeof batchLiveSessionsAbsenteesQuerySchema>,
  z.output<typeof batchLiveSessionsAbsenteesResponseSchema>,
  typeof batchIdParamsSchema
>({
  metadata: listBatchesRosterMetadata,
  input: batchLiveSessionsAbsenteesQuerySchema,
  params: batchIdParamsSchema,
  output: batchLiveSessionsAbsenteesResponseSchema,
  handler: async ({ tx, ctx, input, params }) =>
    listBatchLiveSessionAbsentees(tx, ctx, params.batchId, input),
});
