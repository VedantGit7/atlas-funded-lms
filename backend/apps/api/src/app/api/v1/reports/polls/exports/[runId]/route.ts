import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import { pollExportRunDetailResponseSchema } from "@atlas/domain/reports/polls-exports.dto";
import { getPollExportRun } from "@atlas/domain/reports/polls-exports.service";
import { reportExportRunParamsSchema } from "@atlas/domain/reports/report-exports.dto";
import { getReportExportsMetadata } from "@atlas/domain/reports/report-exports.route-metadata";

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof pollExportRunDetailResponseSchema>,
  typeof reportExportRunParamsSchema
>({
  metadata: getReportExportsMetadata,
  params: reportExportRunParamsSchema,
  input: noBodySchema,
  output: pollExportRunDetailResponseSchema,
  handler: async ({ tx, ctx, params }) => getPollExportRun(tx, ctx, params["runId"]),
});
