import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import { retryCustomFieldExportResponseSchema } from "@atlas/domain/reports/custom-field-exports.dto";
import { retryCustomFieldExport } from "@atlas/domain/reports/custom-field-exports.service";
import { reportExportRunParamsSchema } from "@atlas/domain/reports/report-exports.dto";
import { retryReportExportMetadata } from "@atlas/domain/reports/report-exports.route-metadata";

export const POST = createTenantRoute<
  Record<string, never>,
  z.output<typeof retryCustomFieldExportResponseSchema>,
  typeof reportExportRunParamsSchema
>({
  metadata: retryReportExportMetadata,
  params: reportExportRunParamsSchema,
  input: noBodySchema,
  output: retryCustomFieldExportResponseSchema,
  handler: async ({ tx, ctx, params }) => retryCustomFieldExport(tx, ctx, params["runId"]),
});
