import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import { retryPollExportResponseSchema } from "@atlas/domain/reports/polls-exports.dto";
import { retryPollExport } from "@atlas/domain/reports/polls-exports.service";
import { reportExportRunParamsSchema } from "@atlas/domain/reports/report-exports.dto";
import { retryReportExportMetadata } from "@atlas/domain/reports/report-exports.route-metadata";

export const POST = createTenantRoute<
  Record<string, never>,
  z.output<typeof retryPollExportResponseSchema>,
  typeof reportExportRunParamsSchema
>({
  metadata: retryReportExportMetadata,
  params: reportExportRunParamsSchema,
  input: noBodySchema,
  output: retryPollExportResponseSchema,
  handler: async ({ tx, ctx, params }) => retryPollExport(tx, ctx, params["runId"]),
});
