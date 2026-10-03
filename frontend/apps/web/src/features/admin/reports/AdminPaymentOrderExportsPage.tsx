"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  Check,
  Download,
  FileSpreadsheet,
  Loader2,
  X,
} from "lucide-react";
import { ClientApiError } from "../../../lib/client-api";
import {
  DropdownField,
  dropdownItemClassName,
} from "../../studio/courses/admin-form-dropdown-shared";
import {
  managePageDescClassName,
  managePageTitleClassName,
  managePrimaryButtonClassName,
  manageSecondaryButtonClassName,
} from "../manage/manage-ui-shared";
import { PaymentsReportTabs } from "./PaymentsReportTabs";
import { PaymentOrdersErrorState } from "./PaymentOrdersStates";
import {
  PAYMENT_ORDER_STATUSES,
  fetchPaymentOrderSummary,
  fetchPaymentOrdersExport,
  type PaymentOrderFilters,
  type PaymentOrderSettlement,
  type PaymentOrderSummary,
} from "./payment-orders-api";
import {
  ALL_ORDER_EXPORT_COLUMN_KEYS,
  ORDER_EXPORT_COLUMNS,
  formatAmount,
  orderExportFilename,
  ordersCheckboxClassName,
  ordersNoteClassName,
  ordersSignalCardClassName,
  ordersSignalLabelClassName,
  ordersSignalValueClassName,
  ordersToCsv,
  type OrderExportColumnKey,
} from "./payment-orders-shared";

/**
 * `/admin/reports/payments/orders/exports`.
 *
 * The ledger's own Export button can only ever write out the rows it has
 * loaded — fifty at a time — so exporting a quarter meant paging through the
 * whole quarter first, and the resulting file silently omitted everything the
 * operator had not scrolled to. This screen exports the filtered set server
 * side instead, states how many rows that is before anything is downloaded, and
 * refuses to be quiet about hitting its own ceiling.
 *
 * It is deliberately a one-shot download rather than an entry in the scheduled
 * Exports tab: those are asynchronous report runs keyed by dataset, and orders
 * is not one of the datasets that pipeline knows about.
 */

const STATUS_FILTERS: Array<{ value: string; label: string }> = [
  { value: "", label: "All statuses" },
  ...PAYMENT_ORDER_STATUSES.map((status) => ({
    value: status,
    label: status.charAt(0).toUpperCase() + status.slice(1),
  })),
];

const SETTLEMENT_FILTERS: Array<{ value: string; label: string }> = [
  { value: "", label: "Any settlement" },
  { value: "settled", label: "Settled" },
  { value: "unsettled", label: "Unsettled" },
];

const panelClassName =
  "admin-glass rounded-xl border border-[var(--admin-border)] p-5 motion-safe:animate-[admin-fade-in_0.2s_ease-out]";

const panelTitleClassName = "text-sm font-bold text-[var(--admin-on-surface)]";

const chipClassName =
  "inline-flex items-center gap-1.5 rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-2.5 py-1 text-xs font-semibold text-[var(--admin-on-surface)]";

function isSettlement(value: string): value is PaymentOrderSettlement {
  return value === "settled" || value === "unsettled";
}

export function AdminPaymentOrderExportsPage() {
  const searchParams = useSearchParams();

  // Seeded from the URL so "Export" on the ledger arrives here already
  // describing the same set of rows the operator was looking at.
  const [status, setStatus] = useState(() => searchParams.get("status") ?? "");
  const [currency, setCurrency] = useState(() =>
    (searchParams.get("currency") ?? "").toUpperCase(),
  );
  const [settlement, setSettlement] = useState<string>(() => {
    const value = searchParams.get("settlement") ?? "";
    return isSettlement(value) ? value : "";
  });
  const [query, setQuery] = useState(() => searchParams.get("q") ?? "");

  const [statusOpen, setStatusOpen] = useState(false);
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [settlementOpen, setSettlementOpen] = useState(false);

  const [columns, setColumns] = useState<Set<OrderExportColumnKey>>(
    () => new Set(ALL_ORDER_EXPORT_COLUMN_KEYS),
  );

  const [summary, setSummary] = useState<PaymentOrderSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const filters: PaymentOrderFilters = useMemo(
    () => ({
      ...(query.trim() ? { q: query.trim() } : {}),
      ...(status ? { status } : {}),
      ...(currency ? { currency } : {}),
      ...(isSettlement(settlement) ? { settlement } : {}),
    }),
    [query, status, currency, settlement],
  );

  const requestId = useRef(0);

  const load = useCallback(async (activeFilters: PaymentOrderFilters) => {
    const ticket = ++requestId.current;
    setLoading(true);
    try {
      const next = await fetchPaymentOrderSummary(activeFilters);
      // A count for filters the operator has already changed would be worse
      // than no count: it would understate or overstate the file.
      if (ticket !== requestId.current) return;
      setSummary(next);
      setError(null);
    } catch (caught) {
      if (ticket !== requestId.current) return;
      setSummary(null);
      setError(
        caught instanceof ClientApiError ? caught.message : "The ledger count could not be read.",
      );
    } finally {
      if (ticket === requestId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(filters);
  }, [load, filters]);

  const selectedColumns = ORDER_EXPORT_COLUMNS.filter((column) => columns.has(column.key));
  const filterCount = Object.keys(filters).length;
  const filename = orderExportFilename(filters);

  const rowCount = summary?.total ?? null;

  function toggleColumn(key: OrderExportColumnKey) {
    setColumns((previous) => {
      const next = new Set(previous);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function clearFilters() {
    setStatus("");
    setCurrency("");
    setSettlement("");
    setQuery("");
  }

  async function download() {
    setDownloading(true);
    setDownloadError(null);
    setNotice(null);
    try {
      const result = await fetchPaymentOrdersExport(filters);
      const csv = ordersToCsv(result.items, [...columns]);
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);

      // The count comes from the response rather than from the preview, because
      // the ledger can have moved between the two reads.
      setNotice(
        result.truncated
          ? `Downloaded the first ${String(result.items.length)} of ${String(result.totalCount)} matching orders — the export ceiling is ${String(result.limit)} rows. Narrow the filters and export again to cover the rest.`
          : `Downloaded ${String(result.items.length)} ${result.items.length === 1 ? "order" : "orders"}.`,
      );
    } catch (caught) {
      setDownloadError(
        caught instanceof ClientApiError ? caught.message : "The export could not be generated.",
      );
    } finally {
      setDownloading(false);
    }
  }

  const currencyOptions = useMemo(() => {
    const codes = new Set(summary?.totalsByCurrency.map((entry) => entry.currency) ?? []);
    if (currency) codes.add(currency);
    return [...codes].sort((a, b) => a.localeCompare(b));
  }, [summary, currency]);

  const activeStatusLabel =
    STATUS_FILTERS.find((entry) => entry.value === status)?.label ?? "All statuses";
  const activeSettlementLabel =
    SETTLEMENT_FILTERS.find((entry) => entry.value === settlement)?.label ?? "Any settlement";

  return (
    <div className="space-y-5">
      <PaymentsReportTabs active="orders" />

      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <Link
            href="/admin/reports/payments/orders"
            className="mb-2 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--admin-on-surface-variant)] transition-colors hover:text-[var(--admin-primary)]"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Payment orders
          </Link>
          <h1 className={managePageTitleClassName}>Export payment orders</h1>
          <p className={managePageDescClassName}>
            A CSV of every order matching the filters below — not just the rows the ledger has
            loaded.
          </p>
        </div>
      </div>

      <div className={ordersNoteClassName}>
        <CalendarClock
          className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-on-surface-variant)]"
          aria-hidden="true"
        />
        <p className="text-sm text-[var(--admin-on-surface-variant)]">
          This downloads immediately in your browser. To schedule the same orders export to run
          daily, weekly or monthly and be emailed out, use{" "}
          <Link
            href="/admin/reports/payments/exports"
            className="font-semibold text-[var(--admin-primary)] hover:underline"
          >
            Payments exports
          </Link>
          .
        </p>
      </div>

      {error !== null ? (
        <PaymentOrdersErrorState
          message={error}
          retrying={loading}
          onRetry={() => {
            void load(filters);
          }}
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="space-y-5 lg:col-span-2">
            <section className={panelClassName}>
              <h2 className={panelTitleClassName}>Which orders</h2>
              <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
                The same filters as the ledger. Leave them all clear to export the whole ledger.
              </p>

              <div className="mt-4 flex flex-wrap items-end gap-3">
                <div className="min-w-[220px] flex-1">
                  <label
                    htmlFor="export-search"
                    className="mb-1.5 block text-xs font-semibold text-[var(--admin-on-surface-variant)]"
                  >
                    Search
                  </label>
                  <input
                    id="export-search"
                    type="search"
                    className="w-full rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-2.5 text-sm text-[var(--admin-on-surface)] outline-none transition-[border-color,box-shadow] placeholder:text-[var(--admin-on-surface-variant)] focus:border-[var(--admin-primary)] focus:ring-2 focus:ring-[var(--admin-primary)]/30"
                    placeholder="External ID, membership ID or order ID"
                    value={query}
                    onChange={(event) => {
                      setQuery(event.target.value);
                    }}
                  />
                </div>

                <div className="w-44">
                  <DropdownField
                    label={
                      <span
                        className="mb-1.5 block text-xs font-semibold text-[var(--admin-on-surface-variant)]"
                        id="export-status-label"
                      >
                        Status
                      </span>
                    }
                    labelId="export-status"
                    open={statusOpen}
                    panelAriaLabel="Filter by status"
                    onToggle={() => {
                      setStatusOpen((previous) => !previous);
                    }}
                    triggerContent={activeStatusLabel}
                  >
                    <div className="flex flex-col gap-0.5 overflow-y-auto p-1.5">
                      {STATUS_FILTERS.map((entry) => (
                        <button
                          key={entry.value || "all"}
                          type="button"
                          role="option"
                          aria-selected={entry.value === status}
                          className={dropdownItemClassName}
                          onClick={() => {
                            setStatus(entry.value);
                            setStatusOpen(false);
                          }}
                        >
                          {entry.label}
                        </button>
                      ))}
                    </div>
                  </DropdownField>
                </div>

                <div className="w-40">
                  <DropdownField
                    label={
                      <span
                        className="mb-1.5 block text-xs font-semibold text-[var(--admin-on-surface-variant)]"
                        id="export-currency-label"
                      >
                        Currency
                      </span>
                    }
                    labelId="export-currency"
                    open={currencyOpen}
                    panelAriaLabel="Filter by currency"
                    onToggle={() => {
                      setCurrencyOpen((previous) => !previous);
                    }}
                    triggerContent={currency === "" ? "All currencies" : currency}
                  >
                    <div className="flex flex-col gap-0.5 overflow-y-auto p-1.5">
                      <button
                        type="button"
                        role="option"
                        aria-selected={currency === ""}
                        className={dropdownItemClassName}
                        onClick={() => {
                          setCurrency("");
                          setCurrencyOpen(false);
                        }}
                      >
                        All currencies
                      </button>
                      {/* Offered from what the ledger actually holds, so an
                          export can never be scoped to a currency this tenant
                          has never traded in. */}
                      {currencyOptions.map((code) => (
                        <button
                          key={code}
                          type="button"
                          role="option"
                          aria-selected={code === currency}
                          className={dropdownItemClassName}
                          onClick={() => {
                            setCurrency(code);
                            setCurrencyOpen(false);
                          }}
                        >
                          {code}
                        </button>
                      ))}
                    </div>
                  </DropdownField>
                </div>

                <div className="w-44">
                  <DropdownField
                    label={
                      <span
                        className="mb-1.5 block text-xs font-semibold text-[var(--admin-on-surface-variant)]"
                        id="export-settlement-label"
                      >
                        Settlement
                      </span>
                    }
                    labelId="export-settlement"
                    open={settlementOpen}
                    panelAriaLabel="Filter by settlement"
                    onToggle={() => {
                      setSettlementOpen((previous) => !previous);
                    }}
                    triggerContent={activeSettlementLabel}
                  >
                    <div className="flex flex-col gap-0.5 overflow-y-auto p-1.5">
                      {SETTLEMENT_FILTERS.map((entry) => (
                        <button
                          key={entry.value || "any"}
                          type="button"
                          role="option"
                          aria-selected={entry.value === settlement}
                          className={dropdownItemClassName}
                          onClick={() => {
                            setSettlement(entry.value);
                            setSettlementOpen(false);
                          }}
                        >
                          {entry.label}
                        </button>
                      ))}
                    </div>
                  </DropdownField>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-[var(--admin-on-surface-variant)]">
                  Exporting:
                </span>
                {filterCount === 0 ? (
                  <span className={chipClassName}>The entire ledger</span>
                ) : (
                  <>
                    {status ? (
                      <span className={chipClassName}>
                        Status: {activeStatusLabel}
                        <button
                          type="button"
                          aria-label="Remove status filter"
                          onClick={() => {
                            setStatus("");
                          }}
                          className="text-[var(--admin-on-surface-variant)] transition-colors hover:text-[var(--admin-danger)]"
                        >
                          <X className="h-3 w-3" aria-hidden="true" />
                        </button>
                      </span>
                    ) : null}
                    {currency ? (
                      <span className={chipClassName}>
                        Currency: {currency}
                        <button
                          type="button"
                          aria-label="Remove currency filter"
                          onClick={() => {
                            setCurrency("");
                          }}
                          className="text-[var(--admin-on-surface-variant)] transition-colors hover:text-[var(--admin-danger)]"
                        >
                          <X className="h-3 w-3" aria-hidden="true" />
                        </button>
                      </span>
                    ) : null}
                    {settlement ? (
                      <span className={chipClassName}>
                        {activeSettlementLabel}
                        <button
                          type="button"
                          aria-label="Remove settlement filter"
                          onClick={() => {
                            setSettlement("");
                          }}
                          className="text-[var(--admin-on-surface-variant)] transition-colors hover:text-[var(--admin-danger)]"
                        >
                          <X className="h-3 w-3" aria-hidden="true" />
                        </button>
                      </span>
                    ) : null}
                    {query.trim() ? (
                      <span className={chipClassName}>
                        Matching “{query.trim()}”
                        <button
                          type="button"
                          aria-label="Remove search filter"
                          onClick={() => {
                            setQuery("");
                          }}
                          className="text-[var(--admin-on-surface-variant)] transition-colors hover:text-[var(--admin-danger)]"
                        >
                          <X className="h-3 w-3" aria-hidden="true" />
                        </button>
                      </span>
                    ) : null}
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="text-xs font-semibold text-[var(--admin-primary)] hover:underline"
                    >
                      Clear all
                    </button>
                  </>
                )}
              </div>
            </section>

            <section className={panelClassName}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className={panelTitleClassName}>Columns</h2>
                  <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
                    Column order in the file is fixed, so deselecting one never reorders the rest.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="text-xs font-semibold text-[var(--admin-primary)] hover:underline"
                    onClick={() => {
                      setColumns(new Set(ALL_ORDER_EXPORT_COLUMN_KEYS));
                    }}
                  >
                    Select all
                  </button>
                  <span className="text-xs text-[var(--admin-on-surface-variant)]">·</span>
                  <button
                    type="button"
                    className="text-xs font-semibold text-[var(--admin-primary)] hover:underline"
                    onClick={() => {
                      // The id alone is still a usable file: it is what every
                      // other column hangs off.
                      setColumns(new Set<OrderExportColumnKey>(["id"]));
                    }}
                  >
                    ID only
                  </button>
                </div>
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {ORDER_EXPORT_COLUMNS.map((column) => (
                  <label
                    key={column.key}
                    className="flex cursor-pointer items-center gap-3 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-2.5 text-sm text-[var(--admin-on-surface)] motion-safe:transition-colors hover:border-[var(--admin-outline)]"
                  >
                    <input
                      type="checkbox"
                      className={ordersCheckboxClassName}
                      checked={columns.has(column.key)}
                      onChange={() => {
                        toggleColumn(column.key);
                      }}
                    />
                    {column.label}
                  </label>
                ))}
              </div>

              {selectedColumns.length === 0 ? (
                <p className="mt-3 text-sm font-semibold text-[var(--admin-warning)]">
                  No columns selected — the export will fall back to all of them rather than write
                  an empty file.
                </p>
              ) : null}
            </section>
          </div>

          <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
            <div className={ordersSignalCardClassName}>
              <span className={ordersSignalLabelClassName}>Rows to export</span>
              <span className={ordersSignalValueClassName}>
                {loading ? (
                  <span className="inline-block h-7 w-20 rounded bg-[var(--admin-surface-high)] motion-safe:animate-pulse align-middle" />
                ) : (
                  (rowCount ?? 0).toLocaleString()
                )}
              </span>
              <p className="mt-2 text-xs text-[var(--admin-on-surface-variant)]">
                Counted across the whole ledger for these filters, not the page you came from.
              </p>
            </div>

            {summary !== null && summary.totalsByCurrency.length > 0 ? (
              <div className={ordersSignalCardClassName}>
                <span className={ordersSignalLabelClassName}>Value in the file</span>
                <ul className="mt-2 space-y-1">
                  {/* One line per currency, never a grand total: summing INR
                      into USD produces an authoritative-looking number that
                      means nothing. */}
                  {summary.totalsByCurrency.map((entry) => (
                    <li
                      key={entry.currency}
                      className="flex items-baseline justify-between gap-3 text-sm"
                    >
                      <span className="font-data tabular-nums text-[var(--admin-on-surface)]">
                        {formatAmount(entry.amountCents, entry.currency)}
                      </span>
                      <span className="text-xs text-[var(--admin-on-surface-variant)]">
                        {entry.count.toLocaleString()} {entry.count === 1 ? "order" : "orders"}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className={ordersSignalCardClassName}>
              <span className={ordersSignalLabelClassName}>File</span>
              <p className="font-data mt-2 break-all text-sm text-[var(--admin-on-surface)]">
                {filename}
              </p>
              <p className="mt-2 text-xs text-[var(--admin-on-surface-variant)]">
                {selectedColumns.length === 0
                  ? `${String(ORDER_EXPORT_COLUMNS.length)} columns`
                  : `${String(selectedColumns.length)} of ${String(ORDER_EXPORT_COLUMNS.length)} columns`}
                , CSV
              </p>
            </div>

            <button
              type="button"
              className={`${managePrimaryButtonClassName} w-full justify-center`}
              disabled={loading || downloading || rowCount === 0}
              onClick={() => {
                void download();
              }}
            >
              {downloading ? (
                <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden="true" />
              ) : (
                <Download className="h-4 w-4" aria-hidden="true" />
              )}
              {downloading ? "Preparing…" : "Download CSV"}
            </button>

            {rowCount === 0 && !loading ? (
              <p className="text-center text-xs text-[var(--admin-on-surface-variant)]">
                Nothing matches these filters, so there is no file to build.
              </p>
            ) : null}

            <Link
              href="/admin/reports/payments/orders"
              className={`${manageSecondaryButtonClassName} w-full justify-center`}
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back to the ledger
            </Link>
          </aside>
        </div>
      )}

      {downloadError !== null ? (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-[color-mix(in_srgb,var(--admin-danger)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_10%,var(--admin-surface))] px-4 py-3 motion-safe:animate-[admin-banner-in_0.18s_ease-out]"
        >
          <AlertTriangle
            className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-danger)]"
            aria-hidden="true"
          />
          <span className="text-sm font-semibold text-[var(--admin-danger)]">{downloadError}</span>
        </div>
      ) : null}

      {notice !== null ? (
        <div
          role="status"
          className="flex items-start gap-3 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-4 py-3 motion-safe:animate-[admin-banner-in_0.18s_ease-out]"
        >
          {/* A truncated export is reported here, in the same place a clean one
              is, because a file that quietly stops at the ceiling is how a
              reconciliation goes wrong months later. */}
          <FileSpreadsheet
            className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-on-surface-variant)]"
            aria-hidden="true"
          />
          <span className="text-sm text-[var(--admin-on-surface)]">{notice}</span>
          <button
            type="button"
            aria-label="Dismiss"
            className="ml-auto text-[var(--admin-on-surface-variant)] transition-colors hover:text-[var(--admin-on-surface)]"
            onClick={() => {
              setNotice(null);
            }}
          >
            <Check className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
