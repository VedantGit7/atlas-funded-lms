import type { TenantTx } from "@atlas/db";
import { withGlobalDb } from "@atlas/db/global-db";
import { withTenantTx } from "@atlas/db/with-tenant-tx";
import type { FxRatesResponse } from "../schemas/fx";
import { listFxRateRows, upsertFxRates } from "../repositories/fx.repository";

/** All cached rates are stored relative to this base currency. */
export const FX_BASE_CURRENCY = "USD";

/** Frankfurter (ECB data, free, no API key). Overridable for tests / self-host. */
const FX_PROVIDER_URL = process.env["FX_PROVIDER_URL"] ?? "https://api.frankfurter.app/latest";

const FETCH_TIMEOUT_MS = 5000;

type ProviderResponse = {
  base: string;
  date: string;
  rates: Record<string, number>;
};

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Fetch the latest USD-based rate table from the live provider. */
export async function fetchLiveRates(): Promise<{ asOf: string; rates: Record<string, number> }> {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, FETCH_TIMEOUT_MS);
  try {
    const url = `${FX_PROVIDER_URL}?from=${FX_BASE_CURRENCY}`;
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`FX provider responded ${String(response.status)}`);
    }
    const payload = (await response.json()) as ProviderResponse;
    // The provider omits the base currency from its own rate table; add it back.
    const rates: Record<string, number> = { [FX_BASE_CURRENCY]: 1, ...payload.rates };
    return { asOf: payload.date, rates };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Scheduled refresh: fetch live rates once, then persist the snapshot for every
 * active tenant. Intended to be driven by a cron. Tenant isolation is still
 * enforced by RLS on each per-tenant transaction.
 */
export async function refreshFxRatesForActiveTenants(
  requestId: string,
): Promise<{ tenants: number; asOf: string }> {
  const { asOf, rates } = await fetchLiveRates();
  const tenants = await withGlobalDb(
    (db) =>
      db.$queryRaw<{ id: string }[]>`
      SELECT id FROM tenants WHERE state = 'ACTIVE' AND deleted_at IS NULL
    `,
  );
  for (const tenant of tenants) {
    await withTenantTx(
      // System job: no user actor, RLS still scopes writes by tenant_id.
      { tenantId: tenant.id, requestId, allowAnonymousTenantRead: true },
      (tx) => upsertFxRates(tx, { base: FX_BASE_CURRENCY, asOf, rates }),
    );
  }
  return { tenants: tenants.length, asOf };
}

/** Fetch live rates and persist them for the current tenant. */
export async function refreshFxRates(tx: TenantTx): Promise<FxRatesResponse> {
  const { asOf, rates } = await fetchLiveRates();
  await upsertFxRates(tx, { base: FX_BASE_CURRENCY, asOf, rates });
  return {
    data: {
      base: FX_BASE_CURRENCY,
      asOf,
      fetchedAt: new Date().toISOString(),
      rates,
    },
  };
}

function toResponse(rows: Awaited<ReturnType<typeof listFxRateRows>>): FxRatesResponse {
  const rates: Record<string, number> = {};
  let asOf: string | null = null;
  let fetchedAt: Date | null = null;
  for (const row of rows) {
    rates[row.quote_currency] = row.rate;
    if (asOf == null || row.as_of > asOf) asOf = row.as_of;
    if (fetchedAt == null || row.fetched_at > fetchedAt) fetchedAt = row.fetched_at;
  }
  return {
    data: {
      base: FX_BASE_CURRENCY,
      asOf,
      fetchedAt: fetchedAt ? fetchedAt.toISOString() : null,
      rates,
    },
  };
}

/**
 * Return the tenant's cached rates without contacting the live provider. Used
 * by high-traffic public paths (e.g. bootstrap) that must stay fast and must
 * not perform network I/O inside an anonymous request.
 */
export async function getCachedFxRates(tx: TenantTx): Promise<FxRatesResponse> {
  const rows = await listFxRateRows(tx);
  return toResponse(rows);
}

/**
 * Return the tenant's cached rates. On-read fallback: if the cache is empty or
 * stale (as-of before today), refresh from the live provider first. A provider
 * failure is non-fatal when a stale cache exists so reads never hard-fail.
 */
export async function getFxRates(tx: TenantTx): Promise<FxRatesResponse> {
  const rows = await listFxRateRows(tx);
  const cached = toResponse(rows);
  const isStale = cached.data.asOf == null || cached.data.asOf < todayUtc();
  if (!isStale) return cached;
  try {
    return await refreshFxRates(tx);
  } catch (error) {
    if (rows.length > 0) return cached;
    throw error;
  }
}

/**
 * Convert an amount between two ISO-4217 currencies using a USD-based rate map.
 * Returns the amount unchanged when either code is missing so callers degrade
 * gracefully rather than showing a wrong figure.
 */
export function convert(
  rates: Record<string, number>,
  amount: number,
  from: string,
  to: string,
): number | null {
  if (from === to) return amount;
  const fromRate = rates[from];
  const toRate = rates[to];
  if (fromRate == null || toRate == null || fromRate === 0) return null;
  return (amount * toRate) / fromRate;
}
