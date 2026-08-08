import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import {
  tenantDeviceMonitorResponseSchema,
  updateTenantDeviceMonitorBodySchema,
} from "../../../../../server/tenant-settings/tenant-settings.contract";
import {
  readTenantDeviceMonitor,
  updateTenantDeviceMonitor,
} from "../../../../../server/tenant-settings/tenant-settings.service";
import { routeMetadata } from "./route.metadata";

type Response = z.output<typeof tenantDeviceMonitorResponseSchema>;
type Body = z.output<typeof updateTenantDeviceMonitorBodySchema>;

export const GET = createTenantRoute<Record<string, never>, Response>({
  metadata: routeMetadata.GET,
  input: noBodySchema,
  output: tenantDeviceMonitorResponseSchema,
  handler: async ({ tx }) => {
    const data = await readTenantDeviceMonitor(tx);
    return { data };
  },
});

export const PUT = createTenantRoute<Body, Response>({
  metadata: routeMetadata.PUT,
  body: updateTenantDeviceMonitorBodySchema,
  output: tenantDeviceMonitorResponseSchema,
  handler: async ({ tx, input }) => {
    const data = await updateTenantDeviceMonitor(tx, input);
    return { data };
  },
});
