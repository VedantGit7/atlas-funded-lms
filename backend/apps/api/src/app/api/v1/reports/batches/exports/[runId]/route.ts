import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import {
  batchExportRunDetailResponseSchema,
  batchExportRunParamsSchema,
} from "@atlas/domain/reports/batches-exports.dto";
import { getBatchesExportsMetadata } from "@atlas/domain/reports/batches-exports.route-metadata";
import { getBatchExportRun } from "@atlas/domain/reports/batches-exports.service";

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof batchExportRunDetailResponseSchema>,
  typeof batchExportRunParamsSchema
>({
  metadata: getBatchesExportsMetadata,
  params: batchExportRunParamsSchema,
  input: noBodySchema,
  output: batchExportRunDetailResponseSchema,
  handler: async ({ tx, ctx, params }) => getBatchExportRun(tx, ctx, params["runId"]),
});
