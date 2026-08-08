import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import {
  createProgressScoreExportBodySchema,
  createProgressScoreExportResponseSchema,
  progressScoreExportsResponseSchema,
} from "@atlas/domain/reports/progress-score-exports.dto";
import {
  createProgressScoreExportMetadata,
  getProgressScoreExportsMetadata,
} from "@atlas/domain/reports/progress-score-exports.route-metadata";
import {
  createProgressScoreExport,
  getProgressScoreExports,
} from "@atlas/domain/reports/progress-score-exports.service";

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof progressScoreExportsResponseSchema>
>({
  metadata: getProgressScoreExportsMetadata,
  input: noBodySchema,
  output: progressScoreExportsResponseSchema,
  handler: async ({ tx, ctx }) => getProgressScoreExports(tx, ctx),
});

export const POST = createTenantRoute<
  z.output<typeof createProgressScoreExportBodySchema>,
  z.output<typeof createProgressScoreExportResponseSchema>
>({
  metadata: createProgressScoreExportMetadata,
  body: createProgressScoreExportBodySchema,
  output: createProgressScoreExportResponseSchema,
  handler: async ({ tx, ctx, input }) => createProgressScoreExport(tx, ctx, input),
});
