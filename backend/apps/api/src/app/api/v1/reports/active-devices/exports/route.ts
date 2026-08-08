import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import {
  activeDevicesExportsResponseSchema,
  createActiveDevicesExportBodySchema,
  createActiveDevicesExportResponseSchema,
} from "@atlas/domain/reports/active-devices-exports.dto";
import {
  createActiveDevicesExportMetadata,
  getActiveDevicesExportsMetadata,
} from "@atlas/domain/reports/active-devices-exports.route-metadata";
import {
  createActiveDevicesExport,
  getActiveDevicesExports,
} from "@atlas/domain/reports/active-devices-exports.service";

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof activeDevicesExportsResponseSchema>
>({
  metadata: getActiveDevicesExportsMetadata,
  input: noBodySchema,
  output: activeDevicesExportsResponseSchema,
  handler: async ({ tx, ctx }) => getActiveDevicesExports(tx, ctx),
});

export const POST = createTenantRoute<
  z.output<typeof createActiveDevicesExportBodySchema>,
  z.output<typeof createActiveDevicesExportResponseSchema>
>({
  metadata: createActiveDevicesExportMetadata,
  body: createActiveDevicesExportBodySchema,
  output: createActiveDevicesExportResponseSchema,
  handler: async ({ tx, ctx, input }) => createActiveDevicesExport(tx, ctx, input),
});
