import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import {
  deviceExportRunParamsSchema,
  retryActiveDevicesExportResponseSchema,
} from "@atlas/domain/reports/active-devices-exports.dto";
import { retryActiveDevicesExportMetadata } from "@atlas/domain/reports/active-devices-exports.route-metadata";
import { retryActiveDevicesExport } from "@atlas/domain/reports/active-devices-exports.service";

export const POST = createTenantRoute<
  Record<string, never>,
  z.output<typeof retryActiveDevicesExportResponseSchema>,
  typeof deviceExportRunParamsSchema
>({
  metadata: retryActiveDevicesExportMetadata,
  params: deviceExportRunParamsSchema,
  input: noBodySchema,
  output: retryActiveDevicesExportResponseSchema,
  handler: async ({ tx, ctx, params }) => retryActiveDevicesExport(tx, ctx, params["runId"]),
});
