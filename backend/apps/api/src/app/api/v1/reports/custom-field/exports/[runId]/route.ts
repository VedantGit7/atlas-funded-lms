import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import { customFieldExportRunDetailResponseSchema } from "@atlas/domain/reports/custom-field-exports.dto";
import { getCustomFieldExportRun } from "@atlas/domain/reports/custom-field-exports.service";
import { reportExportRunParamsSchema } from "@atlas/domain/reports/report-exports.dto";
import { getReportExportsMetadata } from "@atlas/domain/reports/report-exports.route-metadata";

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof customFieldExportRunDetailResponseSchema>,
  typeof reportExportRunParamsSchema
>({
  metadata: getReportExportsMetadata,
  params: reportExportRunParamsSchema,
  input: noBodySchema,
  output: customFieldExportRunDetailResponseSchema,
  handler: async ({ tx, ctx, params }) => getCustomFieldExportRun(tx, ctx, params["runId"]),
});
