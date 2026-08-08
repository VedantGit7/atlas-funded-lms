import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  batchIdParamsSchema,
  batchMessagesListResponseSchema,
  batchMessagesQuerySchema,
} from "@atlas/domain/reports/batches-roster.dto";
import { listBatchesRosterMetadata } from "@atlas/domain/reports/batches-roster.route-metadata";
import { listBatchMessages } from "@atlas/domain/reports/batches-roster.service";

export const GET = createTenantRoute<
  z.output<typeof batchMessagesQuerySchema>,
  z.output<typeof batchMessagesListResponseSchema>,
  typeof batchIdParamsSchema
>({
  metadata: listBatchesRosterMetadata,
  input: batchMessagesQuerySchema,
  params: batchIdParamsSchema,
  output: batchMessagesListResponseSchema,
  handler: async ({ tx, ctx, input, params }) =>
    listBatchMessages(tx, ctx, params["batchId"], input),
});
