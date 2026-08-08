import type { z } from "zod";

import { createTenantRoute, noBodySchema } from "@atlas/api";

import { BrandingResponseSchema } from "@atlas/domain-branding/schemas/branding";

import { publishTenantBrandingAndTheme } from "@atlas/domain-branding";

import { routeMetadata } from "./route.metadata";

type BrandingResponse = z.output<typeof BrandingResponseSchema>;

export const POST = createTenantRoute<Record<string, never>, BrandingResponse>({
  metadata: routeMetadata,

  body: noBodySchema,

  output: BrandingResponseSchema,

  handler: async ({ tx, ctx }) => {
    return publishTenantBrandingAndTheme(tx, {
      tenantId: ctx.tenantId,

      actorMembershipId: ctx.actorMembershipId,

      requestId: ctx.requestId,
    });
  },
});
