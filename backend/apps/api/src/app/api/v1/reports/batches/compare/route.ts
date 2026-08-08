import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  batchesCompareQuerySchema,
  batchesCompareResponseSchema,
} from "@atlas/domain/reports/batches-roster.dto";
import { listBatchesRosterMetadata } from "@atlas/domain/reports/batches-roster.route-metadata";
import { compareBatches } from "@atlas/domain/reports/batches-roster.service";

export const GET = createTenantRoute<
  z.output<typeof batchesCompareQuerySchema>,
  z.output<typeof batchesCompareResponseSchema>
>({
  metadata: listBatchesRosterMetadata,
  input: batchesCompareQuerySchema,
  output: batchesCompareResponseSchema,
  handler: async ({ tx, ctx, input }) => compareBatches(tx, ctx, input),
});
