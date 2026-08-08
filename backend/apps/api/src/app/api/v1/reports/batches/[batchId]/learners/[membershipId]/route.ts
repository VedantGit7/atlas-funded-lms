import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import {
  batchLearnerDetailResponseSchema,
  batchLearnerParamsSchema,
  removeBatchLearnerBodySchema,
  removeBatchLearnerResponseSchema,
} from "@atlas/domain/reports/batches-roster.dto";
import {
  listBatchesRosterMetadata,
  mutateBatchesRosterMetadata,
} from "@atlas/domain/reports/batches-roster.route-metadata";
import {
  getBatchLearnerDetail,
  removeBatchLearner,
} from "@atlas/domain/reports/batches-roster.service";

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof batchLearnerDetailResponseSchema>,
  typeof batchLearnerParamsSchema
>({
  metadata: listBatchesRosterMetadata,
  input: noBodySchema,
  params: batchLearnerParamsSchema,
  output: batchLearnerDetailResponseSchema,
  handler: async ({ tx, ctx, params }) =>
    getBatchLearnerDetail(tx, ctx, params.batchId, params.membershipId),
});

export const DELETE = createTenantRoute<
  z.output<typeof removeBatchLearnerBodySchema>,
  z.output<typeof removeBatchLearnerResponseSchema>,
  typeof batchLearnerParamsSchema
>({
  metadata: mutateBatchesRosterMetadata,
  params: batchLearnerParamsSchema,
  input: removeBatchLearnerBodySchema,
  output: removeBatchLearnerResponseSchema,
  handler: async ({ tx, ctx, params, input }) =>
    removeBatchLearner(tx, ctx, params.batchId, params.membershipId, input),
});
