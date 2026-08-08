import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  batchLiveSessionAttendeesListResponseSchema,
  batchLiveSessionAttendeesQuerySchema,
  batchLiveSessionParamsSchema,
} from "@atlas/domain/reports/batches-roster.dto";
import { listBatchesRosterMetadata } from "@atlas/domain/reports/batches-roster.route-metadata";
import { listBatchLiveSessionAttendees } from "@atlas/domain/reports/batches-roster.service";

export const GET = createTenantRoute<
  z.output<typeof batchLiveSessionAttendeesQuerySchema>,
  z.output<typeof batchLiveSessionAttendeesListResponseSchema>,
  typeof batchLiveSessionParamsSchema
>({
  metadata: listBatchesRosterMetadata,
  input: batchLiveSessionAttendeesQuerySchema,
  params: batchLiveSessionParamsSchema,
  output: batchLiveSessionAttendeesListResponseSchema,
  handler: async ({ tx, ctx, input, params }) =>
    listBatchLiveSessionAttendees(tx, ctx, params["batchId"], params["sessionId"], input),
});
