"use client";

import Link from "next/link";
import {
  AlertTriangle,
  CalendarDays,
  Check,
  ChevronRight,
  Link2,
  Plug,
  RefreshCw,
  Settings2,
  Terminal,
  Unplug,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ClientApiError } from "../../../lib/client-api";
import {
  dateInputToEndIso,
  dateInputToStartIso,
  fetchPaymentGateways,
  type PaymentGatewayItem,
  type PaymentGatewaysSummary,
} from "./admin-payments-roster-api";
import { PaymentsReportTabs } from "./PaymentsReportTabs";

function defaultDateRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to.getTime() - 29 * 24 * 60 * 60 * 1000);
  const toIso = to.toISOString().slice(0, 10);
  const fromIso = from.toISOString().slice(0, 10);
  return { from: fromIso, to: toIso };
}

function formatMoney(cents: number, currency: string): string {
  return `${(cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`;
}

function formatShortDate(iso: string): string {
  const date = new Date(iso.includes("T") ? iso : `${iso}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function gatewayStatus(gateway: PaymentGatewayItem): {
  label: string;
  className: string;
  railClass: string;
  muted: boolean;
} {
  if (gateway.isPublished) {
    return {
      label: "Published",
      className:
        "border-[color-mix(in_srgb,var(--admin-success)_30%,transparent)] bg-[color-mix(in_srgb,var(--admin-success)_12%,transparent)] text-[var(--admin-success)]",
      railClass: "bg-[var(--admin-success)]",
      muted: false,
    };
  }
  if (gateway.isConfigured) {
    return {
      label: "Configured",
      className:
        "border-[color-mix(in_srgb,var(--admin-warning)_30%,transparent)] bg-[color-mix(in_srgb,var(--admin-warning)_12%,transparent)] text-[var(--admin-warning)]",
      railClass: "bg-[var(--admin-warning)]",
      muted: false,
    };
  }
  return {
    label: "Draft",
    className:
      "border-[var(--admin-border)] bg-[var(--admin-surface-variant)] text-[var(--admin-on-surface-variant)]",
    railClass: "bg-[var(--admin-on-surface-variant)]",
    muted: true,
  };
}

function shareBarTone(index: number): string {
  if (index === 0) return "bg-[var(--admin-primary)]";
  if (index === 1) {
    return "bg-[color-mix(in_srgb,var(--admin-primary)_65%,var(--admin-surface))]";
  }
  if (index === 2) {
    return "bg-[color-mix(in_srgb,var(--admin-primary)_40%,var(--admin-surface))]";
  }
  return "bg-[color-mix(in_srgb,var(--admin-primary)_25%,var(--admin-surface))]";
}

function Shimmer({ className }: { className?: string }) {
  return (
    <div
      className={[
        "relative overflow-hidden rounded-sm bg-[var(--admin-surface-high)]",
        "after:absolute after:inset-0 after:-translate-x-full motion-safe:after:animate-[shimmer_1.8s_infinite]",
        "after:bg-gradient-to-r after:from-transparent after:via-[color-mix(in_srgb,var(--admin-on-surface)_8%,transparent)] after:to-transparent",
        className ?? "",
      ].join(" ")}
    />
  );
}

function GatewaysLoadingSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading payment gateways">
      <div className="rounded border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
        <div className="mb-4 flex items-center justify-between gap-4">
          <Shimmer className="h-3 w-40" />
          <Shimmer className="h-3 w-28" />
        </div>
        <Shimmer className="h-2 w-full rounded-full" />
        <div className="mt-4 flex gap-6">
          <Shimmer className="h-3 w-24" />
          <Shimmer className="h-3 w-24" />
          <Shimmer className="h-3 w-20" />
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <Shimmer className="h-3 w-44" />
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="relative overflow-hidden rounded border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 pl-6"
          >
            <div className="absolute bottom-0 left-0 top-0 w-1 bg-[var(--admin-surface-high)]" />
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-4">
                <Shimmer className="h-10 w-10 rounded" />
                <div className="space-y-2">
                  <Shimmer className="h-4 w-32" />
                  <Shimmer className="h-3 w-48" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-6">
                <Shimmer className="h-8 w-16" />
                <Shimmer className="h-8 w-20" />
                <Shimmer className="h-8 w-14" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminPaymentsGatewaysPage() {
  const defaults = useMemo(() => defaultDateRange(), []);
  const [paidFrom, setPaidFrom] = useState(defaults.from);
  const [paidTo, setPaidTo] = useState(defaults.to);
  const [items, setItems] = useState<PaymentGatewayItem[]>([]);
  const [summary, setSummary] = useState<PaymentGatewaysSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchPaymentGateways({
        paidFrom: dateInputToStartIso(paidFrom),
        paidTo: dateInputToEndIso(paidTo),
      });
      setItems(response.data.items);
      setSummary(response.data.summary);
    } catch (loadError) {
      setItems([]);
      setSummary(null);
      setError(
        loadError instanceof ClientApiError
          ? loadError.message
          : loadError instanceof Error
            ? loadError.message
            : "Unable to load payment gateways.",
      );
    } finally {
      setLoading(false);
    }
  }, [paidFrom, paidTo]);

  useEffect(() => {
    void load();
  }, [load]);

  const activeShareItems = useMemo(
    () => items.filter((item) => item.paidAmountCents > 0),
    [items],
  );

  const isEmpty = !loading && !error && items.length === 0;
  const dateLabel =
    paidFrom && paidTo
      ? `${formatShortDate(paidFrom)} – ${formatShortDate(paidTo)}`
      : summary?.windowLabel ?? "Selected range";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <nav className="flex items-center gap-2 font-mono text-xs text-[var(--admin-on-surface-variant)]">
          <Link href="/admin" className="hover:text-[var(--admin-primary)]">
            Admin
          </Link>
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          <Link href="/admin/reports/payments" className="hover:text-[var(--admin-primary)]">
            Reports
          </Link>
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="text-[var(--admin-on-surface)]">Payments</span>
        </nav>

        <PaymentsReportTabs active="gateways" />

        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--admin-on-surface)] md:text-3xl">
              Payment gateways
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-[var(--admin-on-surface-variant)]">
              Volume, success rate, and configuration status per provider.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex h-9 items-center gap-2 rounded border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 font-mono text-xs text-[var(--admin-on-surface)]">
              <CalendarDays
                className="h-4 w-4 text-[var(--admin-on-surface-variant)]"
                aria-hidden="true"
              />
              <span className="sr-only">From</span>
              <input
                type="date"
                value={paidFrom}
                onChange={(event) => setPaidFrom(event.target.value)}
                className="bg-transparent outline-none"
              />
              <span className="text-[var(--admin-on-surface-variant)]">–</span>
              <span className="sr-only">To</span>
              <input
                type="date"
                value={paidTo}
                onChange={(event) => setPaidTo(event.target.value)}
                className="bg-transparent outline-none"
              />
            </label>
            <button
              type="button"
              className="inline-flex h-9 items-center gap-2 rounded border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 font-mono text-xs font-bold uppercase tracking-wide text-[var(--admin-on-surface)] hover:border-[var(--admin-primary)] hover:text-[var(--admin-primary)] disabled:opacity-50"
              disabled={loading}
              onClick={() => void load()}
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Refresh
            </button>
            <Link
              href="/admin/learner-billing/payment-gateway"
              className="inline-flex h-9 items-center gap-2 rounded border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 font-mono text-xs font-bold uppercase tracking-wide text-[var(--admin-on-surface)] hover:border-[var(--admin-primary)] hover:text-[var(--admin-primary)]"
            >
              <Settings2 className="h-4 w-4" aria-hidden="true" />
              Gateway settings
            </Link>
            <Link
              href="/admin/learner-billing/payment-gateway"
              className="inline-flex h-9 items-center gap-2 rounded bg-[var(--admin-primary)] px-4 font-mono text-xs font-bold uppercase tracking-wide text-[var(--admin-on-primary)]"
            >
              <Link2 className="h-4 w-4" aria-hidden="true" />
              Connect a gateway
            </Link>
          </div>
        </div>
      </div>

      {error ? (
        <div
          role="alert"
          className="flex items-start gap-3 rounded border border-[color-mix(in_srgb,var(--admin-danger)_35%,transparent)] bg-[color-mix(in_srgb,var(--admin-danger)_10%,transparent)] p-4 text-sm text-[var(--admin-danger)]"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <div className="flex flex-1 flex-col gap-2">
            <p>{error}</p>
            <button
              type="button"
              className="w-fit font-mono text-xs font-bold uppercase tracking-wide underline"
              onClick={() => void load()}
            >
              Try again
            </button>
          </div>
        </div>
      ) : null}

      {loading ? <GatewaysLoadingSkeleton /> : null}

      {isEmpty ? (
        <div className="relative flex min-h-[420px] items-center justify-center overflow-hidden rounded border border-[var(--admin-border)] bg-[var(--admin-surface)] p-8">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage:
                "linear-gradient(var(--admin-border) 1px, transparent 1px), linear-gradient(90deg, var(--admin-border) 1px, transparent 1px)",
              backgroundSize: "32px 32px",
            }}
            aria-hidden="true"
          />
          <div className="relative z-10 flex max-w-md flex-col items-center text-center">
            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]">
              <Unplug className="h-8 w-8" aria-hidden="true" />
            </div>
            <h2 className="text-xl font-semibold text-[var(--admin-on-surface)]">
              No payment gateways connected
            </h2>
            <p className="mt-2 text-sm text-[var(--admin-on-surface-variant)]">
              Connect a provider to start accepting payments and track volume share.
            </p>
            <Link
              href="/admin/learner-billing/payment-gateway"
              className="mt-8 inline-flex items-center gap-2 rounded bg-[var(--admin-primary)] px-6 py-2 font-mono text-xs font-bold uppercase tracking-wide text-[var(--admin-on-primary)]"
            >
              <Plug className="h-4 w-4" aria-hidden="true" />
              Connect a gateway
            </Link>
          </div>
        </div>
      ) : null}

      {!loading && !error && !isEmpty ? (
        <>
          <section className="flex flex-col gap-4 rounded border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-mono text-xs font-bold uppercase tracking-widest text-[var(--admin-on-surface-variant)]">
                {summary?.windowLabel ?? "Period"} volume share
              </h2>
              <span className="font-mono text-xs text-[var(--admin-primary)]">
                Total:{" "}
                {formatMoney(
                  summary?.totalPaidCents ?? 0,
                  summary?.currency ?? items[0]?.currency ?? "USD",
                )}
              </span>
            </div>
            <div
              className="flex h-2 w-full overflow-hidden rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface-high)]"
              role="img"
              aria-label={`Volume share across gateways for ${dateLabel}`}
            >
              {activeShareItems.length === 0 ? (
                <div className="h-full w-full bg-[var(--admin-surface-variant)]" />
              ) : (
                activeShareItems.map((item, index) => (
                  <div
                    key={item.id}
                    className={`h-full motion-safe:transition-all motion-safe:duration-700 motion-safe:ease-out ${shareBarTone(index)}`}
                    style={{ width: `${Math.max(item.volumeSharePercent, 0.5)}%` }}
                    title={`${item.displayName}: ${item.volumeSharePercent}%`}
                  />
                ))
              )}
            </div>
            <div className="flex items-center gap-6 overflow-x-auto">
              {activeShareItems.length === 0 ? (
                <p className="font-mono text-xs text-[var(--admin-on-surface-variant)]">
                  No paid volume in {dateLabel}.
                </p>
              ) : (
                activeShareItems.map((item, index) => (
                  <div key={item.id} className="flex min-w-max items-center gap-2">
                    <div className={`h-3 w-3 rounded-sm ${shareBarTone(index)}`} aria-hidden="true" />
                    <span className="font-mono text-xs text-[var(--admin-on-surface)]">
                      {item.displayName}{" "}
                      <span className="text-[var(--admin-on-surface-variant)]">
                        {item.volumeSharePercent}%
                      </span>
                    </span>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="pl-1 font-mono text-xs font-bold uppercase tracking-widest text-[var(--admin-on-surface-variant)]">
              Configured gateways
            </h2>
            {items.map((gateway) => {
              const status = gatewayStatus(gateway);
              const configureHref = `/admin/learner-billing/payment-gateway/${gateway.id}/configure`;
              const detailHref = `/admin/reports/payments/gateways/${encodeURIComponent(gateway.gatewayKey)}`;

              return (
                <article
                  key={gateway.id}
                  className={[
                    "relative overflow-hidden rounded border border-[var(--admin-border)] bg-[var(--admin-surface)] transition-colors hover:border-[color-mix(in_srgb,var(--admin-primary)_40%,var(--admin-border))]",
                    status.muted ? "bg-[var(--admin-surface-low)] opacity-80 hover:opacity-100" : "",
                  ].join(" ")}
                >
                  <div
                    className={`absolute bottom-0 left-0 top-0 w-1 ${status.railClass}`}
                    aria-hidden="true"
                  />
                  <div className="flex flex-col justify-between gap-4 p-4 pl-6 md:flex-row md:items-center">
                    <div className="flex w-full items-start gap-4 md:w-auto">
                      <Link
                        href={detailHref}
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded border border-[var(--admin-border)] bg-[var(--admin-surface-high)] font-semibold text-[var(--admin-on-surface)]"
                        aria-label={`Open ${gateway.displayName} details`}
                      >
                        {gateway.displayName.trim().charAt(0).toUpperCase() || "G"}
                      </Link>
                      <div className="flex min-w-0 flex-col">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-bold text-[var(--admin-on-surface)]">
                            <Link href={detailHref} className="hover:text-[var(--admin-primary)]">
                              {gateway.displayName}
                            </Link>
                          </h3>
                          <span
                            className={`rounded px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide border ${status.className}`}
                          >
                            {status.label}
                          </span>
                          {gateway.isDefault ? (
                            <span className="rounded border border-[var(--admin-border)] bg-[var(--admin-surface-variant)] px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                              Default
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 hidden font-mono text-xs text-[var(--admin-on-surface-variant)] md:block">
                          {gateway.gatewayKey}
                          {!gateway.isConfigured ? " · Missing keys" : ""}
                        </p>
                      </div>
                    </div>

                    {!gateway.isConfigured ? (
                      <div className="flex w-full justify-end border-t border-[var(--admin-border)] pt-4 md:w-auto md:border-t-0 md:pt-0">
                        <Link
                          href={configureHref}
                          className="inline-flex items-center rounded border border-[var(--admin-primary)] px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-wide text-[var(--admin-primary)] hover:bg-[color-mix(in_srgb,var(--admin-primary)_10%,transparent)]"
                        >
                          Finish setup
                        </Link>
                      </div>
                    ) : (
                      <div className="grid w-full grid-cols-2 gap-4 border-t border-[var(--admin-border)] pt-4 md:mt-0 md:flex md:w-auto md:items-center md:gap-8 md:border-t-0 md:pt-0">
                        <div className="flex flex-col">
                          <span className="font-mono text-[10px] font-bold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                            Txns
                          </span>
                          <span className="font-mono text-xs text-[var(--admin-on-surface)]">
                            {gateway.paidTransactionCount.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex flex-col">
                          <span className="font-mono text-[10px] font-bold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                            Volume
                          </span>
                          <span className="font-mono text-xs text-[var(--admin-on-surface)]">
                            {formatMoney(gateway.paidAmountCents, gateway.currency)}
                          </span>
                        </div>
                        <div className="flex flex-col">
                          <span className="font-mono text-[10px] font-bold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                            Success
                          </span>
                          <span className="font-mono text-xs text-[var(--admin-success)]">
                            {gateway.successPercent == null
                              ? "—"
                              : `${gateway.successPercent.toFixed(1)}%`}
                          </span>
                        </div>
                        <div className="col-span-2 flex items-center justify-end gap-2 md:col-span-1">
                          <Link
                            href={configureHref}
                            className="rounded border border-transparent p-2 text-[var(--admin-on-surface-variant)] hover:border-[var(--admin-border)] hover:text-[var(--admin-primary)]"
                            title="Gateway settings"
                            aria-label={`Configure ${gateway.displayName}`}
                          >
                            <Settings2 className="h-4 w-4" aria-hidden="true" />
                          </Link>
                          <Link
                            href={detailHref}
                            className="rounded border border-transparent p-2 text-[var(--admin-on-surface-variant)] hover:border-[var(--admin-border)] hover:text-[var(--admin-primary)]"
                            title="View gateway details"
                            aria-label={`View details for ${gateway.displayName}`}
                          >
                            <Terminal className="h-4 w-4" aria-hidden="true" />
                          </Link>
                        </div>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </section>

          <section className="mt-2">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="pl-1 font-mono text-xs font-bold uppercase tracking-widest text-[var(--admin-on-surface-variant)]">
                Settlement health
              </h2>
            </div>
            <div className="rounded border border-dashed border-[var(--admin-border)] bg-[var(--admin-surface)] p-6">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-[var(--admin-border)] bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]">
                  <Check className="h-4 w-4" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[var(--admin-on-surface)]">
                    Payout reconciliation is not available yet
                  </p>
                  <p className="mt-1 max-w-2xl text-sm text-[var(--admin-on-surface-variant)]">
                    Settlement rows (gross, fees, net, expected date) will appear here once
                    provider payout feeds are connected. Volume and success above already
                    reflect paid ledger activity for {dateLabel}.
                  </p>
                </div>
              </div>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
