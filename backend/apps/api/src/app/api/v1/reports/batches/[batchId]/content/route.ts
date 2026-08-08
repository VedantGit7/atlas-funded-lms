import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  batchContentQuerySchema,
  batchContentResponseSchema,
  batchIdParamsSchema,
} from "@atlas/domain/reports/batches-roster.dto";
import { listBatchesRosterMetadata } from "@atlas/domain/reports/batches-roster.route-metadata";
import { getBatchContentReport } from "@atlas/domain/reports/batches-roster.service";

export const GET = createTenantRoute<
  z.output<typeof batchContentQuerySchema>,
  z.output<typeof batchContentResponseSchema>,
  typeof batchIdParamsSchema
>({
  metadata: listBatchesRosterMetadata,
  input: batchContentQuerySchema,
  params: batchIdParamsSchema,
  output: batchContentResponseSchema,
  handler: async ({ tx, ctx, params }) => getBatchContentReport(tx, ctx, params.batchId),
});
