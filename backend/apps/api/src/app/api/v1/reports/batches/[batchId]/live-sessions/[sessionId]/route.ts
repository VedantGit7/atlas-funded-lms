import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import {
  batchLiveSessionDetailResponseSchema,
  batchLiveSessionParamsSchema,
} from "@atlas/domain/reports/batches-roster.dto";
import { listBatchesRosterMetadata } from "@atlas/domain/reports/batches-roster.route-metadata";
import { getBatchLiveSessionDetail } from "@atlas/domain/reports/batches-roster.service";

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof batchLiveSessionDetailResponseSchema>,
  typeof batchLiveSessionParamsSchema
>({
  metadata: listBatchesRosterMetadata,
  input: noBodySchema,
  params: batchLiveSessionParamsSchema,
  output: batchLiveSessionDetailResponseSchema,
  handler: async ({ tx, ctx, params }) =>
    getBatchLiveSessionDetail(tx, ctx, params["batchId"], params["sessionId"]),
});
