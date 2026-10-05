import { createTenantRoute, noBodySchema } from "@atlas/api";
import { FxRatesResponseSchema, type FxRatesResponse } from "@atlas/domain-config/schemas/fx";
import { getFxRates, refreshFxRates } from "@atlas/domain-config/services/fx.service";
import { recordAuditChange } from "@atlas/api-server/audit-change";
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
  handler: async ({ tx, ctx }) => {
    const before = await getFxRates(tx);
    const after = await refreshFxRates(tx);
    // Audit M7: these rates price every non-base-currency checkout.
    await recordAuditChange(tx, ctx, {
      action: "fx.rates.refreshed",
      target: { type: "fx_rates", id: null },
      before: before.data,
      after: after.data,
    });
    return after;
  },
});
