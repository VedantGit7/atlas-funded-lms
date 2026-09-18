import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { batchResponseSchema, updateBatchBodySchema } from "@atlas/domain/batches/batches.dto";
import {
  deleteBatchMetadata,
  getBatchMetadata,
  updateBatchMetadata,
} from "@atlas/domain/batches/batches.route-metadata";
import { deleteBatch, getBatch, updateBatch } from "@atlas/domain/batches/batches.service";
import { z as zod } from "zod";

const paramsSchema = zod.object({ id: zod.uuid() });
const deletedResponseSchema = zod.object({ data: zod.object({ deleted: zod.boolean() }) });

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof batchResponseSchema>,
  typeof paramsSchema
>({
  metadata: getBatchMetadata,
  params: paramsSchema,
  output: batchResponseSchema,
  handler: async ({ tx, ctx, params }) => getBatch(tx, ctx, params["id"]),
});

export const PATCH = createTenantRoute<
  z.output<typeof updateBatchBodySchema>,
  z.output<typeof batchResponseSchema>,
  typeof paramsSchema
>({
  metadata: updateBatchMetadata,
  params: paramsSchema,
  input: updateBatchBodySchema,
  output: batchResponseSchema,
  handler: async ({ tx, ctx, params, input }) => updateBatch(tx, ctx, params["id"], input),
});

export const DELETE = createTenantRoute<
  Record<string, never>,
  z.output<typeof deletedResponseSchema>,
  typeof paramsSchema
>({
  metadata: deleteBatchMetadata,
  params: paramsSchema,
  output: deletedResponseSchema,
  handler: async ({ tx, ctx, params }) => deleteBatch(tx, ctx, params["id"]),
});
