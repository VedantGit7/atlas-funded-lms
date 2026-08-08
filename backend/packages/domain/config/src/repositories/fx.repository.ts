import type { TenantTx } from "@atlas/db";

export type FxRateRow = {
  base_currency: string;
  quote_currency: string;
  rate: number;
  as_of: string;
  fetched_at: Date;
};

export async function listFxRateRows(tx: TenantTx): Promise<FxRateRow[]> {
  return tx.$queryRaw<FxRateRow[]>`
    SELECT
      base_currency,
      quote_currency,
      rate::float8 AS rate,
      as_of::text AS as_of,
      fetched_at
    FROM fx_rates
  `;
}

/**
 * Replace the cached rate set for the tenant with a fresh snapshot. Rates are
 * upserted (base kept stable) so readers never observe a partially-cleared set.
 */
export async function upsertFxRates(
  tx: TenantTx,
  args: { base: string; asOf: string; rates: Record<string, number> },
): Promise<void> {
  const entries = Object.entries(args.rates);
  for (const [quote, rate] of entries) {
    await tx.$executeRaw`
      INSERT INTO fx_rates (tenant_id, base_currency, quote_currency, rate, as_of, fetched_at)
      VALUES (current_setting('app.tenant_id')::uuid, ${args.base}, ${quote}, ${rate}, ${args.asOf}::date, now())
      ON CONFLICT (tenant_id, base_currency, quote_currency)
      DO UPDATE SET rate = ${rate}, as_of = ${args.asOf}::date, fetched_at = now()
    `;
  }
}
