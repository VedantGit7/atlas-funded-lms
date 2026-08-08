import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import {
  createBatchExportBodySchema,
  createBatchExportResponseSchema,
  batchesExportsResponseSchema,
} from "@atlas/domain/reports/batches-exports.dto";
import {
  createBatchesExportMetadata,
  getBatchesExportsMetadata,
} from "@atlas/domain/reports/batches-exports.route-metadata";
import {
  createBatchExport,
  getBatchesExports,
} from "@atlas/domain/reports/batches-exports.service";

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof batchesExportsResponseSchema>
>({
  metadata: getBatchesExportsMetadata,
  input: noBodySchema,
  output: batchesExportsResponseSchema,
  handler: async ({ tx, ctx }) => getBatchesExports(tx, ctx),
});

export const POST = createTenantRoute<
  z.output<typeof createBatchExportBodySchema>,
  z.output<typeof createBatchExportResponseSchema>
>({
  metadata: createBatchesExportMetadata,
  body: createBatchExportBodySchema,
  output: createBatchExportResponseSchema,
  handler: async ({ tx, ctx, input }) => createBatchExport(tx, ctx, input),
});
