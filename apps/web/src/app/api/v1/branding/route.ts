import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import {
  BrandingResponseSchema,
  UpdateTenantBrandingRequestSchema,
} from "@atlas/domain-branding/schemas/branding";
import { readTenantBranding, updateTenantBrandingDraft } from "@atlas/domain-branding";
import { routeMetadata, putRouteMetadata } from "./route.metadata";

type BrandingResponse = z.output<typeof BrandingResponseSchema>;
type UpdateTenantBrandingRequest = z.output<typeof UpdateTenantBrandingRequestSchema>;

export const GET = createTenantRoute<Record<string, never>, BrandingResponse>({
  metadata: routeMetadata,
  input: noBodySchema,
  output: BrandingResponseSchema,
  handler: async ({ tx }) => readTenantBranding(tx),
});

export const PUT = createTenantRoute<UpdateTenantBrandingRequest, BrandingResponse>({
  metadata: putRouteMetadata,
  body: UpdateTenantBrandingRequestSchema,
  output: BrandingResponseSchema,
  handler: async ({ tx, input }) => updateTenantBrandingDraft(tx, input),
});
