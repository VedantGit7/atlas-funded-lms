import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import {
  tenantTimezoneResponseSchema,
  updateTenantTimezoneBodySchema,
} from "../../../../../server/tenant-settings/tenant-settings.contract";
import {
  readTenantDefaultTimezone,
  updateTenantDefaultTimezone,
} from "../../../../../server/tenant-settings/tenant-settings.service";
import { routeMetadata } from "./route.metadata";

type TenantTimezoneResponse = z.output<typeof tenantTimezoneResponseSchema>;
type UpdateTenantTimezoneBody = z.output<typeof updateTenantTimezoneBodySchema>;

export const GET = createTenantRoute<Record<string, never>, TenantTimezoneResponse>({
  metadata: routeMetadata.GET,
  input: noBodySchema,
  output: tenantTimezoneResponseSchema,
  handler: async ({ tx }) => {
    const timezone = await readTenantDefaultTimezone(tx);
    return { data: { timezone } };
  },
});

export const PUT = createTenantRoute<UpdateTenantTimezoneBody, TenantTimezoneResponse>({
  metadata: routeMetadata.PUT,
  body: updateTenantTimezoneBodySchema,
  output: tenantTimezoneResponseSchema,
  handler: async ({ tx, input }) => {
    const result = await updateTenantDefaultTimezone(tx, input.timezone);
    return { data: result };
  },
});
