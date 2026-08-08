import type { z } from "zod";

import { createTenantRoute, noBodySchema } from "@atlas/api";

import { BrandingVersionsResponseSchema } from "@atlas/domain-branding/schemas/branding";

import { readTenantBrandingVersions } from "@atlas/domain-branding";

import { routeMetadata } from "./route.metadata";

type BrandingVersionsResponse = z.output<typeof BrandingVersionsResponseSchema>;

export const GET = createTenantRoute<Record<string, never>, BrandingVersionsResponse>({
  metadata: routeMetadata,

  input: noBodySchema,

  output: BrandingVersionsResponseSchema,

  handler: async ({ tx }) => readTenantBrandingVersions(tx),
});
