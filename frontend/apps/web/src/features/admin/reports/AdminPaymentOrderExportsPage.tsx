"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { ReportInitialData } from "../../../lib/server/report-initial-data";
import {
  DropdownField,
  dropdownItemClassName,
} from "../../studio/courses/admin-form-dropdown-shared";
import {
  DirectExportPage,
  directExportCardClassName,
  directExportCardLabelClassName,
  directExportLabelClassName,
  useDirectExport,
  type DirectExportChip,
} from "./direct-export-kit";
import { PaymentsReportTabs } from "./PaymentsReportTabs";
import { PaymentOrdersErrorState } from "./PaymentOrdersStates";
import {
  paymentOrderExportFilters,
  readPaymentOrderExportFields,
  type PaymentOrderSummary,
  PAYMENT_ORDER_STATUSES,
  fetchPaymentOrderSummary,
  fetchPaymentOrdersExport,
  type PaymentOrderFilters,
} from "./payment-orders-api";
import {
  ALL_ORDER_EXPORT_COLUMN_KEYS,
  ORDER_EXPORT_COLUMNS,
  formatAmountFor,
  orderExportFilename,
  ordersToCsv,
  type OrderExportColumnKey,
} from "./payment-orders-shared";
import { useViewerLocale, withViewer } from "./viewer-time";

/**
 * `/admin/reports/payments/orders/exports`: the filtered order ledger as a
 * CSV, now (see direct-export-kit). The scheduled version is the Orders dataset
 * on Payments exports.
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

const ORDERS_HREF = "/admin/reports/payments/orders";

const searchFieldClassName =
  "w-full rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-2.5 text-sm text-[var(--admin-on-surface)] outline-none transition-[border-color,box-shadow] placeholder:text-[var(--admin-on-surface-variant)] focus:border-[var(--admin-primary)] focus:ring-2 focus:ring-[var(--admin-primary)]/30";

export function AdminPaymentOrderExportsPage({
  initialSummary,
}: {
  /** The count for the filters in the address, loaded by the server; the first browser load is skipped when present. */
  initialSummary?: ReportInitialData<PaymentOrderSummary> | null;
} = {}) {
  const viewer = useViewerLocale();
  const formatAmount = withViewer(formatAmountFor, viewer);
  const searchParams = useSearchParams();

  // Seeded from the URL so "Export" on the ledger arrives here already
  // describing the same set of rows the operator was looking at. Read once,
  // like the server's count below.
  const [seed] = useState(() => readPaymentOrderExportFields((name) => searchParams.get(name)));
  const [initial] = useState(() => initialSummary ?? null);
  const [status, setStatus] = useState(seed.status);
  const [currency, setCurrency] = useState(seed.currency);
  const [settlement, setSettlement] = useState<string>(seed.settlement);
  const [query, setQuery] = useState(seed.query);

  const [statusOpen, setStatusOpen] = useState(false);
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [settlementOpen, setSettlementOpen] = useState(false);

  const filters: PaymentOrderFilters = useMemo(
    () => paymentOrderExportFilters({ status, currency, settlement, query }),
    [query, status, currency, settlement],
  );

  const exportState = useDirectExport({
    filters,
    fetchSummary: fetchPaymentOrderSummary,
    fetchExport: fetchPaymentOrdersExport,
    allColumns: ALL_ORDER_EXPORT_COLUMN_KEYS,
    toCsv: ordersToCsv,
    filename: orderExportFilename(filters),
    noun: { one: "order", many: "orders" },
    narrow: "the filters",
    summaryErrorMessage: "The ledger count could not be read.",
    initial,
  });
  const { summary } = exportState;

  const currencyOptions = useMemo(() => {
    const codes = new Set(summary?.totalsByCurrency.map((entry) => entry.currency) ?? []);
    if (currency) codes.add(currency);
    return [...codes].sort((a, b) => a.localeCompare(b));
  }, [summary, currency]);

  const activeStatusLabel =
    STATUS_FILTERS.find((entry) => entry.value === status)?.label ?? "All statuses";
  const activeSettlementLabel =
    SETTLEMENT_FILTERS.find((entry) => entry.value === settlement)?.label ?? "Any settlement";

  const chips: DirectExportChip[] = [
    ...(status
      ? [
          {
            key: "status",
            label: <>Status: {activeStatusLabel}</>,
            removeLabel: "Remove status filter",
            onRemove: () => {
              setStatus("");
            },
          },
        ]
      : []),
    ...(currency
      ? [
          {
            key: "currency",
            label: <>Currency: {currency}</>,
            removeLabel: "Remove currency filter",
            onRemove: () => {
              setCurrency("");
            },
          },
        ]
      : []),
    ...(settlement
      ? [
          {
            key: "settlement",
            label: activeSettlementLabel,
            removeLabel: "Remove settlement filter",
            onRemove: () => {
              setSettlement("");
            },
          },
        ]
      : []),
    ...(query.trim()
      ? [
          {
            key: "q",
            label: <>Matching “{query.trim()}”</>,
            removeLabel: "Remove search filter",
            onRemove: () => {
              setQuery("");
            },
          },
        ]
      : []),
  ];

  return (
    <DirectExportPage
      state={exportState}
      tabs={<PaymentsReportTabs active="orders" />}
      back={{ href: ORDERS_HREF, label: "Payment orders", returnLabel: "Back to the ledger" }}
      title="Export payment orders"
      description="A CSV of every order matching the filters below, not just the rows the ledger has loaded."
      scheduleNote={
        <>
          This downloads immediately in your browser. To schedule the same orders export to run
          daily, weekly or monthly and be emailed out, use{" "}
          <Link
            href="/admin/reports/payments/exports"
            className="font-semibold text-[var(--admin-primary)] hover:underline"
          >
            Payments exports
          </Link>
          .
        </>
      }
      renderError={(props) => <PaymentOrdersErrorState {...props} />}
      scope={{
        title: "Which orders",
        description:
          "The same filters as the ledger. Leave them all clear to export the whole ledger.",
        everythingLabel: "The entire ledger",
        chips,
        onClearAll: () => {
          setStatus("");
          setCurrency("");
          setSettlement("");
          setQuery("");
        },
        fields: (
          <>
            <div className="min-w-[220px] flex-1">
              <label htmlFor="export-search" className={directExportLabelClassName}>
                Search
              </label>
              <input
                id="export-search"
                type="search"
                className={searchFieldClassName}
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
                  <span className={directExportLabelClassName} id="export-status-label">
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
                  <span className={directExportLabelClassName} id="export-currency-label">
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
                  {/* Offered from what the ledger actually holds, so an export
                      can never be scoped to a currency this tenant has never
                      traded in. */}
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
                  <span className={directExportLabelClassName} id="export-settlement-label">
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
          </>
        ),
      }}
      columnOptions={ORDER_EXPORT_COLUMNS}
      // The id alone is still a usable file: it is what every other column
      // hangs off.
      columnPreset={{ label: "ID only", columns: ["id"] satisfies OrderExportColumnKey[] }}
      rowCount={summary?.total ?? null}
      rowCountHint="Counted across the whole ledger for these filters, not the page you came from."
      detail={
        summary !== null && summary.totalsByCurrency.length > 0 ? (
          <div className={directExportCardClassName}>
            <span className={directExportCardLabelClassName}>Value in the file</span>
            <ul className="mt-2 space-y-1">
              {/* One line per currency, never a grand total: summing INR into
                  USD produces an authoritative-looking number that means
                  nothing. */}
              {summary.totalsByCurrency.map((entry) => (
                <li
                  key={entry.currency}
                  className="flex items-baseline justify-between gap-3 text-sm"
                >
                  <span className="font-data tabular-nums text-[var(--admin-on-surface)]">
                    {formatAmount(entry.amountCents, entry.currency)}
                  </span>
                  <span className="text-xs text-[var(--admin-on-surface-variant)]">
                    {entry.count.toLocaleString(viewer.locale)}{" "}
                    {entry.count === 1 ? "order" : "orders"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null
      }
    />
  );
}
