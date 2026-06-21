import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import {
  TenantConfigResponseSchema,
  UpdateTenantConfigRequestSchema,
} from "@atlas/domain-config/schemas/tenant-config";
import { readTenantConfig, updateTenantConfigDraft } from "@atlas/domain-config";
import { routeMetadata, putRouteMetadata } from "./route.metadata";

type TenantConfigResponse = z.output<typeof TenantConfigResponseSchema>;
type UpdateTenantConfigRequest = z.output<typeof UpdateTenantConfigRequestSchema>;

export const GET = createTenantRoute<Record<string, never>, TenantConfigResponse>({
  metadata: routeMetadata,
  input: noBodySchema,
  output: TenantConfigResponseSchema,
  handler: async ({ tx }) => readTenantConfig(tx),
});

export const PUT = createTenantRoute<UpdateTenantConfigRequest, TenantConfigResponse>({
  metadata: putRouteMetadata,
  body: UpdateTenantConfigRequestSchema,
  output: TenantConfigResponseSchema,
  handler: async ({ tx, input }) => updateTenantConfigDraft(tx, input),
});
