import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import {
  tenantEmailChannelResponseSchema,
  updateTenantEmailChannelBodySchema,
} from "../../../../../server/tenant-settings/tenant-settings.contract";
import {
  readTenantEmailChannel,
  updateTenantEmailChannel,
} from "../../../../../server/tenant-settings/tenant-settings.service";
import { routeMetadata } from "./route.metadata";

type Response = z.output<typeof tenantEmailChannelResponseSchema>;
type Body = z.output<typeof updateTenantEmailChannelBodySchema>;

export const GET = createTenantRoute<Record<string, never>, Response>({
  metadata: routeMetadata.GET,
  input: noBodySchema,
  output: tenantEmailChannelResponseSchema,
  handler: async ({ tx }) => {
    const data = await readTenantEmailChannel(tx, "marketingEmail");
    return { data };
  },
});

export const PUT = createTenantRoute<Body, Response>({
  metadata: routeMetadata.PUT,
  body: updateTenantEmailChannelBodySchema,
  output: tenantEmailChannelResponseSchema,
  handler: async ({ tx, input }) => {
    const data = await updateTenantEmailChannel(tx, "marketingEmail", input);
    return { data };
  },
});
