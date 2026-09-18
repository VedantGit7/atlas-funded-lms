"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Clock, Loader2, RefreshCw } from "lucide-react";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import { currencyName } from "./currency-options";
import {
  FX_STALE_AFTER_MS,
  formatFxRate,
  isFxStale,
  rateAgainstHome,
  rateSentence,
} from "./fx-rates-shared";

type FxRates = {
  base: string;
  asOf: string | null;
  fetchedAt: string | null;
  rates: Record<string, number>;
};

/**
 * Conversion rates used to price in a learner's currency against the tenant's
 * home currency.
 *
 * `GET /api/v1/fx/rates` and its `POST` refresh existed with no caller, so the
 * rates driving displayed prices were invisible: an admin could not see how
 * stale they were, and had no way to pull fresh ones after setting a home
 * currency.
 *
 * The stored table is always USD-based — `FX_BASE_CURRENCY` on the server, no
 * matter what a tenant chooses as home. So the rates are shown against the home
 * currency by dividing through, and the panel says where they came from. Simply
 * relabelling the USD figures as home-currency ones would be wrong by exactly
 * the USD/home rate, which for a weak currency is a factor of eighty.
 */
export function FxRatesPanel({ homeCurrency }: { homeCurrency: string | null }) {
  const [rates, setRates] = useState<FxRates | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await clientApi.get<{ data: FxRates }>("/api/v1/fx/rates");
      setRates(response.data);
    } catch (caught) {
      setError(
        caught instanceof ClientApiError ? caught.message : "Could not load exchange rates.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleRefresh() {
    setRefreshing(true);
    setError(null);
    try {
      const response = await clientApi.post<{ data: FxRates }>(
        "/api/v1/fx/rates",
        null,
        "fx-refresh",
        { successMessage: "Exchange rates refreshed." },
      );
      setRates(response.data);
    } catch (caught) {
      setError(
        caught instanceof ClientApiError ? caught.message : "Could not refresh exchange rates.",
      );
    } finally {
      setRefreshing(false);
    }
  }

  // Quoted against the home currency when there is one, otherwise against the
  // stored base. The heading says which, because the two differ by a factor
  // nobody can eyeball.
  const quoteCurrency = homeCurrency ?? rates?.base ?? null;
  const derived = homeCurrency !== null && rates !== null && homeCurrency !== rates.base;
  const homeRateMissing =
    homeCurrency !== null && rates !== null && rates.rates[homeCurrency] === undefined;

  const entries = Object.entries(rates?.rates ?? {})
    .filter(([code]) => code !== quoteCurrency)
    .map(([code]) => ({
      code,
      rate:
        rates === null || quoteCurrency === null
          ? null
          : rateAgainstHome(rates.rates, code, quoteCurrency),
    }))
    .sort((a, b) => a.code.localeCompare(b.code));

  const stale = isFxStale(rates?.fetchedAt ?? null);
  const staleDays = Math.round(FX_STALE_AFTER_MS / 86_400_000);

  return (
    <section className="admin-glass rounded-2xl border border-[var(--admin-border)] p-6 motion-safe:animate-[admin-fade-in_0.2s_ease-out]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-[var(--admin-on-surface)]">Exchange rates</h2>
          <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
            {quoteCurrency === null
              ? "Rates used to convert prices into a learner's currency."
              : `Quoted against ${quoteCurrency}${
                  currencyName(quoteCurrency) === null
                    ? ""
                    : ` — ${currencyName(quoteCurrency) ?? ""}`
                }`}
          </p>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--admin-border)] px-3 py-2 text-sm font-semibold text-[var(--admin-on-surface)] transition-colors hover:bg-[var(--admin-surface-high)] disabled:opacity-60"
          disabled={refreshing || loading}
          onClick={() => void handleRefresh()}
        >
          {refreshing ? (
            <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden="true" />
          ) : (
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
          )}
          {refreshing ? "Refreshing…" : "Refresh rates"}
        </button>
      </div>

      {rates !== null && (rates.asOf ?? rates.fetchedAt) !== null ? (
        <p className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-[var(--admin-on-surface-variant)]">
          <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {rates.asOf === null ? null : <span>Rates as of {rates.asOf}.</span>}
          {rates.fetchedAt === null ? null : (
            <span>Last fetched {new Date(rates.fetchedAt).toLocaleString()}.</span>
          )}
        </p>
      ) : null}

      {derived ? (
        <p className="mt-3 text-xs text-[var(--admin-on-surface-variant)]">
          {/* The provenance matters: these are two-hop figures, and an admin
              reconciling against a bank quote needs to know that. */}
          Derived from the stored {rates.base} table, which is what the provider publishes.
        </p>
      ) : null}

      {stale ? (
        <div
          role="status"
          className="mt-4 flex items-start gap-3 rounded-xl border border-[color-mix(in_srgb,var(--admin-warning)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_8%,var(--admin-surface))] px-4 py-3"
        >
          <AlertTriangle
            className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-warning)]"
            aria-hidden="true"
          />
          {/* A rate table from last month quietly misprices every course, and
              nothing else on this screen would say so. */}
          <p className="text-sm text-[var(--admin-on-surface-variant)]">
            These rates are more than {staleDays} days old. Every price shown to a learner in
            another currency is being converted with them — refresh before trusting a figure.
          </p>
        </div>
      ) : null}

      {homeRateMissing ? (
        <div
          role="alert"
          className="mt-4 flex items-start gap-3 rounded-xl border border-[color-mix(in_srgb,var(--admin-danger)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_10%,var(--admin-surface))] px-4 py-3"
        >
          <AlertTriangle
            className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-danger)]"
            aria-hidden="true"
          />
          {/* Without a rate for the home currency there is no second hop, so
              nothing below can be quoted at all. */}
          <p className="text-sm text-[var(--admin-on-surface-variant)]">
            The rate table has no entry for {homeCurrency}, so nothing can be converted into it.
            Refresh the rates; if it stays missing, the provider does not publish this currency.
          </p>
        </div>
      ) : null}

      {error !== null ? (
        <p role="alert" className="mt-3 text-sm font-medium text-[var(--admin-danger)]">
          {error}
        </p>
      ) : null}

      {loading ? (
        <ul
          className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4"
          aria-hidden="true"
        >
          {Array.from({ length: 12 }, (_, index) => (
            <li
              key={index}
              className="h-[42px] rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-high)] motion-safe:animate-pulse"
            />
          ))}
        </ul>
      ) : entries.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--admin-on-surface-variant)]">
          No rates stored yet. Refresh to fetch them.
        </p>
      ) : (
        <>
          <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {entries.map((entry) => (
              <li
                key={entry.code}
                className="flex items-baseline justify-between gap-2 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-3 py-2 text-sm"
                title={
                  entry.rate === null || quoteCurrency === null
                    ? `No rate available for ${entry.code}`
                    : rateSentence(quoteCurrency, entry.code, entry.rate)
                }
              >
                <span className="font-data text-xs text-[var(--admin-on-surface-variant)]">
                  {entry.code}
                </span>
                <span className="font-data font-semibold tabular-nums text-[var(--admin-on-surface)]">
                  {/* A missing leg reads as unknown, never as a number derived
                      from a rate that is not there. */}
                  {entry.rate === null ? (
                    <span className="text-[var(--admin-on-surface-variant)]">—</span>
                  ) : (
                    formatFxRate(entry.rate)
                  )}
                </span>
              </li>
            ))}
          </ul>
          {quoteCurrency === null ? null : (
            <p className="mt-3 text-xs text-[var(--admin-on-surface-variant)]">
              {/* The direction, said once. "AED 0.0442" alone does not say
                  whether that is per rupee or per dirham. */}
              Read as: 1 {quoteCurrency} buys this much of each currency.
            </p>
          )}
        </>
      )}

      <p className="mt-4 text-xs text-[var(--admin-on-surface-variant)]">
        Prices shown to learners are set per region in{" "}
        <Link
          href="/admin/learner-billing/locations"
          className="font-semibold text-[var(--admin-primary)] hover:underline"
        >
          Locations
        </Link>
        .
      </p>
    </section>
  );
}
