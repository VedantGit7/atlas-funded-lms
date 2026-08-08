import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import { TenantConfigResponseSchema } from "@atlas/domain-config/schemas/tenant-config";
import { publishTenantConfig } from "@atlas/domain-config";
import { routeMetadata } from "./route.metadata";

type TenantConfigResponse = z.output<typeof TenantConfigResponseSchema>;

export const POST = createTenantRoute<Record<string, never>, TenantConfigResponse>({
  metadata: routeMetadata,
  body: noBodySchema,
  output: TenantConfigResponseSchema,
  handler: async ({ tx, ctx }) =>
    publishTenantConfig(tx, {
      tenantId: ctx.tenantId,
      actorMembershipId: ctx.actorMembershipId,
      requestId: ctx.requestId,
    }),
});
