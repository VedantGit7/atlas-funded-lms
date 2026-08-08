import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import {
  batchIdParamsSchema,
  batchMessagesNudgesResponseSchema,
  updateBatchMessagesNudgesBodySchema,
} from "@atlas/domain/reports/batches-roster.dto";
import {
  listBatchesRosterMetadata,
  mutateBatchesRosterMetadata,
} from "@atlas/domain/reports/batches-roster.route-metadata";
import {
  listBatchMessageNudges,
  updateBatchMessageNudges,
} from "@atlas/domain/reports/batches-roster.service";

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof batchMessagesNudgesResponseSchema>,
  typeof batchIdParamsSchema
>({
  metadata: listBatchesRosterMetadata,
  input: noBodySchema,
  params: batchIdParamsSchema,
  output: batchMessagesNudgesResponseSchema,
  handler: async ({ tx, ctx, params }) => listBatchMessageNudges(tx, ctx, params["batchId"]),
});

export const PATCH = createTenantRoute<
  z.output<typeof updateBatchMessagesNudgesBodySchema>,
  z.output<typeof batchMessagesNudgesResponseSchema>,
  typeof batchIdParamsSchema
>({
  metadata: mutateBatchesRosterMetadata,
  body: updateBatchMessagesNudgesBodySchema,
  params: batchIdParamsSchema,
  output: batchMessagesNudgesResponseSchema,
  handler: async ({ tx, ctx, input, params }) =>
    updateBatchMessageNudges(tx, ctx, params["batchId"], input.nudges),
});
