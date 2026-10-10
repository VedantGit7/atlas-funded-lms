import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import { retryActiveDevicesExportResponseSchema } from "@atlas/domain/reports/active-devices-exports.dto";
import { retryActiveDevicesExport } from "@atlas/domain/reports/active-devices-exports.service";
import { reportExportRunParamsSchema } from "@atlas/domain/reports/report-exports.dto";
import { retryReportExportMetadata } from "@atlas/domain/reports/report-exports.route-metadata";

export const POST = createTenantRoute<
  Record<string, never>,
  z.output<typeof retryActiveDevicesExportResponseSchema>,
  typeof reportExportRunParamsSchema
>({
  metadata: retryReportExportMetadata,
  params: reportExportRunParamsSchema,
  input: noBodySchema,
  output: retryActiveDevicesExportResponseSchema,
  handler: async ({ tx, ctx, params }) => retryActiveDevicesExport(tx, ctx, params["runId"]),
});
