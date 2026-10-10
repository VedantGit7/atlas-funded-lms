import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import {
  createPollExportBodySchema,
  createPollExportResponseSchema,
  pollsExportsResponseSchema,
} from "@atlas/domain/reports/polls-exports.dto";
import { createPollExport, getPollsExports } from "@atlas/domain/reports/polls-exports.service";
import {
  createReportExportMetadata,
  getReportExportsMetadata,
} from "@atlas/domain/reports/report-exports.route-metadata";

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof pollsExportsResponseSchema>
>({
  metadata: getReportExportsMetadata,
  input: noBodySchema,
  output: pollsExportsResponseSchema,
  handler: async ({ tx, ctx }) => getPollsExports(tx, ctx),
});

export const POST = createTenantRoute<
  z.output<typeof createPollExportBodySchema>,
  z.output<typeof createPollExportResponseSchema>
>({
  metadata: createReportExportMetadata,
  body: createPollExportBodySchema,
  output: createPollExportResponseSchema,
  handler: async ({ tx, ctx, input }) => createPollExport(tx, ctx, input),
});
