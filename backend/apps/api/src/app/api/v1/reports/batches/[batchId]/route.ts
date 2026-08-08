import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import {
  batchDetailResponseSchema,
  batchIdParamsSchema,
} from "@atlas/domain/reports/batches-roster.dto";
import { listBatchesRosterMetadata } from "@atlas/domain/reports/batches-roster.route-metadata";
import { getBatchDetailedReport } from "@atlas/domain/reports/batches-roster.service";

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof batchDetailResponseSchema>,
  typeof batchIdParamsSchema
>({
  metadata: listBatchesRosterMetadata,
  input: noBodySchema,
  params: batchIdParamsSchema,
  output: batchDetailResponseSchema,
  handler: async ({ tx, ctx, params }) => getBatchDetailedReport(tx, ctx, params.batchId),
});
