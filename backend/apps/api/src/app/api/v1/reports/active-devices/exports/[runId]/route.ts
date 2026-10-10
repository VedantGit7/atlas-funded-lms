import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import { deviceExportRunDetailResponseSchema } from "@atlas/domain/reports/active-devices-exports.dto";
import { getActiveDevicesExportRun } from "@atlas/domain/reports/active-devices-exports.service";
import { reportExportRunParamsSchema } from "@atlas/domain/reports/report-exports.dto";
import { getReportExportsMetadata } from "@atlas/domain/reports/report-exports.route-metadata";

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof deviceExportRunDetailResponseSchema>,
  typeof reportExportRunParamsSchema
>({
  metadata: getReportExportsMetadata,
  params: reportExportRunParamsSchema,
  input: noBodySchema,
  output: deviceExportRunDetailResponseSchema,
  handler: async ({ tx, ctx, params }) => getActiveDevicesExportRun(tx, ctx, params["runId"]),
});
