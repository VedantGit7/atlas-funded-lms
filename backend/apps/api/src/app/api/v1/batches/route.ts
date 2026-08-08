import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  batchListResponseSchema,
  batchResponseSchema,
  createBatchBodySchema,
} from "@atlas/domain/batches/batches.dto";
import {
  createBatchMetadata,
  listBatchesMetadata,
} from "@atlas/domain/batches/batches.route-metadata";
import { createBatch, listBatches } from "@atlas/domain/batches/batches.service";

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof batchListResponseSchema>
>({
  metadata: listBatchesMetadata,
  output: batchListResponseSchema,
  handler: async ({ tx, ctx }) => listBatches(tx, ctx),
});

export const POST = createTenantRoute<
  z.output<typeof createBatchBodySchema>,
  z.output<typeof batchResponseSchema>
>({
  metadata: createBatchMetadata,
  input: createBatchBodySchema,
  output: batchResponseSchema,
  handler: async ({ tx, ctx, input }) => createBatch(tx, ctx, input),
});
