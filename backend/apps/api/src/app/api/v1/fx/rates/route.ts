import { createTenantRoute, noBodySchema } from "@atlas/api";
import { FxRatesResponseSchema, type FxRatesResponse } from "@atlas/domain-config/schemas/fx";
import { getFxRates, refreshFxRates } from "@atlas/domain-config/services/fx.service";
import { getRouteMetadata, postRouteMetadata } from "./route.metadata";

export const GET = createTenantRoute<Record<string, never>, FxRatesResponse>({
  metadata: getRouteMetadata,
  input: noBodySchema,
  output: FxRatesResponseSchema,
  handler: async ({ tx }) => getFxRates(tx),
});

export const POST = createTenantRoute<Record<string, never>, FxRatesResponse>({
  metadata: postRouteMetadata,
  input: noBodySchema,
  output: FxRatesResponseSchema,
  handler: async ({ tx }) => refreshFxRates(tx),
});
