import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import {
  tenantAdminOtpResponseSchema,
  updateTenantAdminOtpBodySchema,
} from "../../../../../server/tenant-settings/tenant-settings.contract";
import {
  readTenantAdminOtp,
  updateTenantAdminOtp,
} from "../../../../../server/tenant-settings/tenant-settings.service";
import { routeMetadata } from "./route.metadata";

type Response = z.output<typeof tenantAdminOtpResponseSchema>;
type Body = z.output<typeof updateTenantAdminOtpBodySchema>;

export const GET = createTenantRoute<Record<string, never>, Response>({
  metadata: routeMetadata.GET,
  input: noBodySchema,
  output: tenantAdminOtpResponseSchema,
  handler: async ({ tx }) => {
    const data = await readTenantAdminOtp(tx);
    return { data };
  },
});

export const PUT = createTenantRoute<Body, Response>({
  metadata: routeMetadata.PUT,
  body: updateTenantAdminOtpBodySchema,
  output: tenantAdminOtpResponseSchema,
  handler: async ({ tx, input }) => {
    const data = await updateTenantAdminOtp(tx, input);
    return { data };
  },
});
