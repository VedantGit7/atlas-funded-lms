import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  batchesListQuerySchema,
  batchesListResponseSchema,
} from "@atlas/domain/reports/batches-roster.dto";
import { listBatchesRosterMetadata } from "@atlas/domain/reports/batches-roster.route-metadata";
import { listBatchesRoster } from "@atlas/domain/reports/batches-roster.service";

export const GET = createTenantRoute<
  z.output<typeof batchesListQuerySchema>,
  z.output<typeof batchesListResponseSchema>
>({
  metadata: listBatchesRosterMetadata,
  input: batchesListQuerySchema,
  output: batchesListResponseSchema,
  handler: async ({ tx, ctx, input }) => listBatchesRoster(tx, ctx, input),
});
