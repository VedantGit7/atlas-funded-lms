import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import {
  batchContentStalledResponseSchema,
  batchIdParamsSchema,
} from "@atlas/domain/reports/batches-roster.dto";
import { listBatchesRosterMetadata } from "@atlas/domain/reports/batches-roster.route-metadata";
import { listBatchContentStalled } from "@atlas/domain/reports/batches-roster.service";

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof batchContentStalledResponseSchema>,
  typeof batchIdParamsSchema
>({
  metadata: listBatchesRosterMetadata,
  input: noBodySchema,
  params: batchIdParamsSchema,
  output: batchContentStalledResponseSchema,
  handler: async ({ tx, ctx, params }) => listBatchContentStalled(tx, ctx, params["batchId"]),
});
