import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  batchIdParamsSchema,
  retryBatchMessageBodySchema,
  sendBatchMessageResponseSchema,
} from "@atlas/domain/reports/batches-roster.dto";
import { mutateBatchesRosterMetadata } from "@atlas/domain/reports/batches-roster.route-metadata";
import { retryBatchRosterMessage } from "../../../../../../../../server/reports/batches-roster-actions.service";

export const POST = createTenantRoute<
  z.output<typeof retryBatchMessageBodySchema>,
  z.output<typeof sendBatchMessageResponseSchema>,
  typeof batchIdParamsSchema
>({
  metadata: mutateBatchesRosterMetadata,
  body: retryBatchMessageBodySchema,
  params: batchIdParamsSchema,
  output: sendBatchMessageResponseSchema,
  handler: async ({ tx, ctx, input, params }) =>
    retryBatchRosterMessage(tx, ctx, params["batchId"], input.sendGroupId),
});
