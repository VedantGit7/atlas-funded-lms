import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import {
  tenantFastCheckoutResponseSchema,
  updateTenantFastCheckoutBodySchema,
} from "../../../../../server/tenant-settings/tenant-settings.contract";
import {
  readTenantFastCheckout,
  updateTenantFastCheckout,
} from "../../../../../server/tenant-settings/tenant-settings.service";
import { routeMetadata } from "./route.metadata";

type TenantFastCheckoutResponse = z.output<typeof tenantFastCheckoutResponseSchema>;
type UpdateTenantFastCheckoutBody = z.output<typeof updateTenantFastCheckoutBodySchema>;

export const GET = createTenantRoute<Record<string, never>, TenantFastCheckoutResponse>({
  metadata: routeMetadata.GET,
  input: noBodySchema,
  output: tenantFastCheckoutResponseSchema,
  handler: async ({ tx }) => {
    const result = await readTenantFastCheckout(tx);
    return { data: result };
  },
});

export const PUT = createTenantRoute<UpdateTenantFastCheckoutBody, TenantFastCheckoutResponse>({
  metadata: routeMetadata.PUT,
  body: updateTenantFastCheckoutBodySchema,
  output: tenantFastCheckoutResponseSchema,
  handler: async ({ tx, input }) => {
    const result = await updateTenantFastCheckout(tx, input.enabled);
    return { data: result };
  },
});
