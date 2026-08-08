import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import {
  pollExportRunParamsSchema,
  retryPollExportResponseSchema,
} from "@atlas/domain/reports/polls-exports.dto";
import { retryPollsExportMetadata } from "@atlas/domain/reports/polls-exports.route-metadata";
import { retryPollExport } from "@atlas/domain/reports/polls-exports.service";

export const POST = createTenantRoute<
  Record<string, never>,
  z.output<typeof retryPollExportResponseSchema>,
  typeof pollExportRunParamsSchema
>({
  metadata: retryPollsExportMetadata,
  params: pollExportRunParamsSchema,
  input: noBodySchema,
  output: retryPollExportResponseSchema,
  handler: async ({ tx, ctx, params }) => retryPollExport(tx, ctx, params["runId"]),
});
