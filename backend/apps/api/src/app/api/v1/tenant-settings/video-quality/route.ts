import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import {
  tenantVideoQualityResponseSchema,
  updateTenantVideoQualityBodySchema,
} from "../../../../../server/tenant-settings/tenant-settings.contract";
import {
  readTenantDefaultVideoQuality,
  updateTenantDefaultVideoQuality,
} from "../../../../../server/tenant-settings/tenant-settings.service";
import { routeMetadata } from "./route.metadata";

type TenantVideoQualityResponse = z.output<typeof tenantVideoQualityResponseSchema>;
type UpdateTenantVideoQualityBody = z.output<typeof updateTenantVideoQualityBodySchema>;

export const GET = createTenantRoute<Record<string, never>, TenantVideoQualityResponse>({
  metadata: routeMetadata.GET,
  input: noBodySchema,
  output: tenantVideoQualityResponseSchema,
  handler: async ({ tx }) => {
    const quality = await readTenantDefaultVideoQuality(tx);
    return { data: { quality } };
  },
});

export const PUT = createTenantRoute<UpdateTenantVideoQualityBody, TenantVideoQualityResponse>({
  metadata: routeMetadata.PUT,
  body: updateTenantVideoQualityBodySchema,
  output: tenantVideoQualityResponseSchema,
  handler: async ({ tx, input }) => {
    const result = await updateTenantDefaultVideoQuality(tx, input.quality);
    return { data: result };
  },
});
