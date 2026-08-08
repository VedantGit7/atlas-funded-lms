import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import {
  deviceExportRunDetailResponseSchema,
  deviceExportRunParamsSchema,
} from "@atlas/domain/reports/active-devices-exports.dto";
import { getActiveDevicesExportsMetadata } from "@atlas/domain/reports/active-devices-exports.route-metadata";
import { getActiveDevicesExportRun } from "@atlas/domain/reports/active-devices-exports.service";

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof deviceExportRunDetailResponseSchema>,
  typeof deviceExportRunParamsSchema
>({
  metadata: getActiveDevicesExportsMetadata,
  params: deviceExportRunParamsSchema,
  input: noBodySchema,
  output: deviceExportRunDetailResponseSchema,
  handler: async ({ tx, ctx, params }) => getActiveDevicesExportRun(tx, ctx, params["runId"]),
});
