"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  Clock,
  Copy,
  Download,
  Info,
  Loader2,
  Plus,
  RotateCcw,
  Search,
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
  manageSearchInputClassName,
  manageSecondaryButtonClassName,
} from "../manage/manage-ui-shared";
import { PaymentsReportTabs } from "./PaymentsReportTabs";
import {
  PAYMENT_ORDER_STATUSES,
  fetchPaymentOrderSummary,
  fetchPaymentOrders,
  type PaymentOrder,
  type PaymentOrderFilters,
  type PaymentOrderSettlement,
  type PaymentOrderSummary,
} from "./payment-orders-api";
import {
  faultLabel,
  formatAmount,
  formatTimestamp,
  orderFaults,
  ordersCheckboxClassName,
  ordersNoteClassName,
  ordersRowClassName,
  ordersRowFaultClassName,
  ordersRowHighlightClassName,
  ordersRowSelectedClassName,
  ordersSelectionBarClassName,
  ordersSignalCardClassName,
  ordersSignalLabelClassName,
  ordersSignalValueClassName,
  ordersTableHeadCellClassName,
  ordersTableShellClassName,
  ordersToCsv,
  ordersToolbarClassName,
  statusChipClassName,
  totalsByCurrency,
} from "./payment-orders-shared";
import {
  PaymentOrdersEmptyState,
  PaymentOrdersErrorState,
  PaymentOrdersNoMatchState,
  PaymentOrdersSkeleton,
} from "./PaymentOrdersStates";

const STATUS_FILTERS = [
  { value: "", label: "All statuses" },
  ...PAYMENT_ORDER_STATUSES.map((value) => ({
    value,
    label: value.charAt(0).toUpperCase() + value.slice(1),
  })),
] as const;

const SETTLEMENT_FILTERS = [
  { value: "", label: "Any settlement" },
  { value: "settled", label: "Settled" },
  { value: "unsettled", label: "Unsettled" },
] as const;

/**
 * Payment orders: the raw ledger rows gateway webhooks settle against.
 *
 * A Stripe or Razorpay webhook finds an order by `externalId` and writes
 * `status` and `paidAt` onto it, so when settlement goes wrong this row is the
 * only place the mismatch is visible. Three things follow, and all three are
 * load-bearing.
 *
 * **The signal band counts the ledger, not the page.** Those totals come from
 * `/payments/orders/summary` under the same filters. Counting the loaded rows
 * would report "3 failed" when it means "3 failed among the fifty I have" — on
 * a paginated financial ledger, worse than showing nothing.
 *
 * **Two faults are surfaced that no other screen shows.** An order with no
 * external id can never be matched by a webhook and will sit pending for ever;
 * an order marked paid with no `paidAt` settled at a time nobody can state.
 *
 * **Totals are never summed across currencies.** A single figure adding INR to
 * USD means nothing and looks authoritative.
 */
export function AdminPaymentOrdersPage() {
  const [orders, setOrders] = useState<PaymentOrder[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [summary, setSummary] = useState<PaymentOrderSummary | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [currency, setCurrency] = useState("");
  const [settlement, setSettlement] = useState("");
  const [statusOpen, setStatusOpen] = useState(false);
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [settlementOpen, setSettlementOpen] = useState(false);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // The record route redirects back naming the new order so the ledger can
  // point at where it landed, rather than leaving the operator to find it.
  const router = useRouter();
  const searchParams = useSearchParams();
  const createdId = searchParams.get("created");
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const highlightRef = useRef<HTMLTableRowElement | null>(null);

  // Typing re-queried on every keystroke before this; the debounce is what makes
  // the search usable against a ledger of any size.
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(searchInput);
    }, 350);
    return () => {
      clearTimeout(timer);
    };
  }, [searchInput]);

  const filters: PaymentOrderFilters = useMemo(
    () => ({
      ...(query.trim() ? { q: query.trim() } : {}),
      ...(status ? { status } : {}),
      ...(currency ? { currency } : {}),
      ...(settlement ? { settlement: settlement as PaymentOrderSettlement } : {}),
    }),
    [query, status, currency, settlement],
  );

  const requestId = useRef(0);

  const load = useCallback(
    async (activeFilters: PaymentOrderFilters, mode: "initial" | "refresh") => {
      const ticket = ++requestId.current;
      if (mode === "initial") setLoading(true);
      else setRefreshing(true);
      setError(null);

      try {
        // The page and the totals are fetched together so the band can never
        // describe a different filter than the table beneath it.
        const [page, totals] = await Promise.all([
          fetchPaymentOrders(activeFilters),
          fetchPaymentOrderSummary(activeFilters),
        ]);
        // A slow response for filters the operator has already changed must not
        // repaint the ledger underneath the ones they are now looking at.
        if (ticket !== requestId.current) return;
        setOrders(page.items);
        setNextCursor(page.pageInfo.nextCursor);
        setSummary(totals);
        setSelectedIds(new Set());
      } catch (caught) {
        if (ticket !== requestId.current) return;
        setOrders([]);
        setNextCursor(null);
        setSummary(null);
        setError(caught instanceof ClientApiError ? caught.message : "Could not load orders.");
      } finally {
        if (ticket === requestId.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    void load(filters, "initial");
  }, [load, filters]);

  // Consumed once and stripped from the URL: a refresh should not re-announce
  // an order recorded ten minutes ago.
  useEffect(() => {
    if (createdId === null) return;
    setHighlightId(createdId);
    router.replace("/admin/reports/payments/orders");
  }, [createdId, router]);

  useEffect(() => {
    if (highlightId === null || loading) return;
    highlightRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [highlightId, loading, orders]);

  const highlightedOrder = useMemo(
    () => (highlightId === null ? null : (orders.find((o) => o.id === highlightId) ?? null)),
    [orders, highlightId],
  );

  async function loadMore() {
    if (nextCursor === null) return;
    setLoadingMore(true);
    setError(null);
    try {
      const page = await fetchPaymentOrders(filters, nextCursor);
      setOrders((previous) => [...previous, ...page.items]);
      setNextCursor(page.pageInfo.nextCursor);
    } catch (caught) {
      setError(caught instanceof ClientApiError ? caught.message : "Could not load more orders.");
    } finally {
      setLoadingMore(false);
    }
  }

  function clearFilters() {
    setSearchInput("");
    setQuery("");
    setStatus("");
    setCurrency("");
    setSettlement("");
  }

  function toggleRow(orderId: string) {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  }

  const allLoadedSelected = orders.length > 0 && orders.every((order) => selectedIds.has(order.id));

  function toggleAll() {
    setSelectedIds(allLoadedSelected ? new Set() : new Set(orders.map((order) => order.id)));
  }

  function copyValue(value: string, label: string) {
    void navigator.clipboard.writeText(value).then(
      () => {
        setNotice(`Copied ${label}.`);
      },
      () => {
        setNotice(null);
      },
    );
  }

  function exportRows(rows: PaymentOrder[]) {
    const csv = ordersToCsv(rows);
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `payment-orders-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    setNotice(`Exported ${String(rows.length)} ${rows.length === 1 ? "order" : "orders"}.`);
  }

  // Filters ride along so the export screen opens describing the same set of
  // rows the operator is looking at.
  const exportsHref = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.q) params.set("q", filters.q);
    if (filters.status) params.set("status", filters.status);
    if (filters.currency) params.set("currency", filters.currency);
    if (filters.settlement) params.set("settlement", filters.settlement);
    const search = params.toString();
    return search
      ? `/admin/reports/payments/orders/exports?${search}`
      : "/admin/reports/payments/orders/exports";
  }, [filters]);

  const selectedOrders = orders.filter((order) => selectedIds.has(order.id));
  const filtered = query.trim() !== "" || status !== "" || currency !== "" || settlement !== "";
  const currencyOptions = useMemo(() => {
    const codes = new Set(summary?.totalsByCurrency.map((entry) => entry.currency) ?? []);
    for (const order of orders) codes.add(order.currency);
    return [...codes].sort((a, b) => a.localeCompare(b));
  }, [summary, orders]);

  const activeStatusLabel =
    STATUS_FILTERS.find((entry) => entry.value === status)?.label ?? "All statuses";
  const activeSettlementLabel =
    SETTLEMENT_FILTERS.find((entry) => entry.value === settlement)?.label ?? "Any settlement";

  return (
    <div className="space-y-5">
      <PaymentsReportTabs active="orders" />

      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <h1 className={managePageTitleClassName}>Payment orders</h1>
          <p className={managePageDescClassName}>
            The raw ledger rows gateway webhooks settle against.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={manageSecondaryButtonClassName}
            disabled={loading || refreshing}
            onClick={() => {
              void load(filters, "refresh");
            }}
          >
            <RotateCcw
              className={`h-4 w-4 ${refreshing ? "motion-safe:animate-spin" : ""}`}
              aria-hidden="true"
            />
            Refresh
          </button>
          {/* The export screen rather than this page's rows: a click here used
              to write out only what had been loaded, so a filtered ledger of
              4,000 orders produced a 50-row file that looked complete. */}
          <Link href={exportsHref} className={manageSecondaryButtonClassName}>
            <Download className="h-4 w-4" aria-hidden="true" />
            Export CSV
          </Link>
          {/* Recording needs `config.update`, which reading this ledger does
              not imply, so the entry point is hidden when the server says the
              operator cannot use it. */}
          {summary === null || summary.capabilities.canRecord ? (
            <Link
              href="/admin/reports/payments/orders/new"
              className={managePrimaryButtonClassName}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Record a manual order
            </Link>
          ) : null}
        </div>
      </div>

      <div className={ordersNoteClassName}>
        <Info
          className="mt-0.5 h-5 w-5 shrink-0 text-[var(--admin-on-surface-variant)]"
          aria-hidden="true"
        />
        <p className="text-sm text-[var(--admin-on-surface-variant)]">
          Orders are the raw rows gateways settle against. Learner, product and gateway detail lives
          in Transactions.
        </p>
      </div>

      {highlightedOrder ? (
        <div
          role="status"
          className="flex flex-wrap items-center gap-2 rounded-lg border border-[color-mix(in_srgb,var(--admin-success)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-success)_10%,var(--admin-surface))] px-3 py-2 text-sm"
        >
          <span className="font-medium text-[var(--admin-success)]">Order recorded.</span>
          <span className="text-[var(--admin-on-surface-variant)]">
            It is highlighted below, in date order.
          </span>
          <button
            type="button"
            className="ml-auto rounded p-1 text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)]"
            aria-label="Dismiss"
            onClick={() => {
              setHighlightId(null);
            }}
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      ) : null}

      {notice ? (
        <p
          role="status"
          className="rounded-lg border border-[color-mix(in_srgb,var(--admin-success)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-success)_10%,var(--admin-surface))] px-3 py-2 text-sm font-medium text-[var(--admin-success)]"
        >
          {notice}
        </p>
      ) : null}

      {/* Every figure here is a ledger-wide total for the active filters, not a
          count of the rows currently loaded. */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <SignalCard
          label={filtered ? "Matching orders" : "Orders in ledger"}
          value={summary?.total}
          loading={loading}
        />
        <SignalCard label="Pending" value={summary?.byStatus["pending"] ?? 0} loading={loading} />
        <SignalCard label="Failed" value={summary?.byStatus["failed"] ?? 0} loading={loading} />
        <SignalCard
          label="No external ID"
          value={summary?.missingExternalId}
          loading={loading}
          tone="warning"
          caption="A webhook cannot settle these"
        />
        <SignalCard
          label="Paid, no timestamp"
          value={summary?.paidWithoutTimestamp}
          loading={loading}
          tone="warning"
          caption="Settled at an unknown time"
        />
      </div>

      {/* Only offered when there is something to reconcile. The worklist scans
          the whole ledger, so these two figures understate it — they are the
          two faults the summary aggregate happens to carry. */}
      {summary !== null && summary.missingExternalId + summary.paidWithoutTimestamp > 0 ? (
        <Link
          href="/admin/reports/payments/orders/unmatched"
          className="flex flex-wrap items-center gap-2 rounded-xl border border-[color-mix(in_srgb,var(--admin-warning)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_8%,var(--admin-surface))] px-4 py-3 text-sm text-[var(--admin-on-surface)] motion-safe:transition-colors hover:bg-[color-mix(in_srgb,var(--admin-warning)_13%,var(--admin-surface))]"
        >
          <AlertTriangle
            className="h-4 w-4 shrink-0 text-[var(--admin-warning)]"
            aria-hidden="true"
          />
          <span>
            Some orders cannot be settled automatically. Work through them on the reconciliation
            worklist, which also finds orders left pending too long.
          </span>
          <span className="ml-auto font-semibold text-[var(--admin-primary)]">Open worklist</span>
        </Link>
      ) : null}

      {summary && summary.totalsByCurrency.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--admin-on-surface-variant)]">
          <span className="font-medium">Ledger total:</span>
          {summary.totalsByCurrency.map((entry) => (
            <span
              key={entry.currency}
              className="font-data rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface)] px-2 py-0.5 text-xs tabular-nums"
            >
              {formatAmount(entry.amountCents, entry.currency)}
            </span>
          ))}
        </div>
      ) : null}

      <div className={ordersToolbarClassName}>
        <div className="relative min-w-[16rem] flex-1">
          <label className="sr-only" htmlFor="order-search">
            Search orders
          </label>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-on-surface-variant)]"
            aria-hidden="true"
          />
          <input
            id="order-search"
            type="search"
            className={manageSearchInputClassName}
            placeholder="External ID, membership ID or order ID"
            value={searchInput}
            onChange={(event) => {
              setSearchInput(event.target.value);
            }}
          />
        </div>

        <div className="w-44">
          <DropdownField
            label={
              <span className="sr-only" id="order-status-label">
                Filter by status
              </span>
            }
            labelId="order-status"
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
              <span className="sr-only" id="order-currency-label">
                Filter by currency
              </span>
            }
            labelId="order-currency"
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
              {/* Offered from what the ledger actually holds rather than a
                  hardcoded list, so a tenant trading in one currency is not
                  shown filters that can only ever return nothing. */}
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
              <span className="sr-only" id="order-settlement-label">
                Filter by settlement
              </span>
            }
            labelId="order-settlement"
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

        {filtered ? (
          <button type="button" className={manageSecondaryButtonClassName} onClick={clearFilters}>
            <X className="h-4 w-4" aria-hidden="true" />
            Clear
          </button>
        ) : null}
      </div>

      {error ? (
        <PaymentOrdersErrorState
          message={error}
          retrying={refreshing}
          onRetry={() => {
            void load(filters, "refresh");
          }}
        />
      ) : null}

      {loading ? (
        <PaymentOrdersSkeleton />
      ) : !error && orders.length === 0 && !filtered ? (
        <PaymentOrdersEmptyState
          createHref="/admin/reports/payments/orders/new"
          canRecord={summary?.capabilities.canRecord ?? true}
        />
      ) : !error && orders.length === 0 ? (
        <PaymentOrdersNoMatchState query={query} onClearFilters={clearFilters} />
      ) : !error ? (
        <div className={ordersTableShellClassName}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[58rem] border-collapse text-sm">
              <caption className="sr-only">
                Payment orders, newest first. Sorting is fixed to creation date.
              </caption>
              <thead className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-high)]">
                <tr>
                  <th scope="col" className={`${ordersTableHeadCellClassName} w-10`}>
                    <input
                      type="checkbox"
                      className={ordersCheckboxClassName}
                      checked={allLoadedSelected}
                      aria-label={
                        allLoadedSelected ? "Clear selection" : "Select all loaded orders"
                      }
                      onChange={toggleAll}
                    />
                  </th>
                  <th scope="col" className={ordersTableHeadCellClassName}>
                    Order ID
                  </th>
                  <th scope="col" className={ordersTableHeadCellClassName}>
                    External ID
                  </th>
                  <th scope="col" className={`${ordersTableHeadCellClassName} w-28`}>
                    Status
                  </th>
                  <th scope="col" className={`${ordersTableHeadCellClassName} w-36 text-right`}>
                    Amount
                  </th>
                  <th scope="col" className={`${ordersTableHeadCellClassName} w-44 text-right`}>
                    Created
                  </th>
                  <th scope="col" className={`${ordersTableHeadCellClassName} w-44 text-right`}>
                    Paid at
                  </th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => {
                  const faults = orderFaults(order);
                  const isSelected = selectedIds.has(order.id);
                  const isHighlighted = order.id === highlightId;
                  return (
                    <tr
                      key={order.id}
                      ref={isHighlighted ? highlightRef : null}
                      className={[
                        ordersRowClassName,
                        isSelected ? ordersRowSelectedClassName : "",
                        isHighlighted ? ordersRowHighlightClassName : "",
                        !isSelected && !isHighlighted && faults.length > 0
                          ? ordersRowFaultClassName
                          : "",
                      ].join(" ")}
                    >
                      <td className="px-4 py-3 align-top">
                        <input
                          type="checkbox"
                          className={ordersCheckboxClassName}
                          checked={isSelected}
                          aria-label={`Select order ${order.id}`}
                          onChange={() => {
                            toggleRow(order.id);
                          }}
                        />
                      </td>
                      <td className="px-4 py-3 align-top">
                        <span className="font-data inline-flex items-center gap-1 text-xs text-[var(--admin-on-surface)]">
                          <Link
                            href={`/admin/reports/payments/orders/${order.id}`}
                            className="underline-offset-2 transition-colors hover:text-[var(--admin-primary)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]"
                          >
                            {order.id}
                          </Link>
                          <button
                            type="button"
                            aria-label="Copy order ID"
                            className="rounded p-0.5 opacity-0 transition-opacity hover:text-[var(--admin-primary)] focus-visible:opacity-100 focus-visible:outline-none group-hover:opacity-100"
                            onClick={() => {
                              copyValue(order.id, "order ID");
                            }}
                          >
                            <Copy className="h-3 w-3" aria-hidden="true" />
                          </button>
                        </span>
                        {faults.map((fault) => (
                          <span
                            key={fault}
                            className="mt-1 flex items-center gap-1 text-[11px] font-medium text-[var(--admin-warning)]"
                          >
                            {fault === "missing-external-id" ? (
                              <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden="true" />
                            ) : (
                              <Clock className="h-3 w-3 shrink-0" aria-hidden="true" />
                            )}
                            {faultLabel(fault)}
                          </span>
                        ))}
                      </td>
                      <td className="px-4 py-3 align-top">
                        {order.externalId !== null && order.externalId.trim() !== "" ? (
                          <span className="font-data inline-flex items-center gap-1 text-xs text-[var(--admin-on-surface-variant)]">
                            <span className="max-w-[16rem] truncate">{order.externalId}</span>
                            <button
                              type="button"
                              aria-label="Copy external ID"
                              className="rounded p-0.5 opacity-0 transition-opacity hover:text-[var(--admin-primary)] focus-visible:opacity-100 focus-visible:outline-none group-hover:opacity-100"
                              onClick={() => {
                                copyValue(order.externalId ?? "", "external ID");
                              }}
                            >
                              <Copy className="h-3 w-3" aria-hidden="true" />
                            </button>
                          </span>
                        ) : (
                          <span className="text-xs italic text-[var(--admin-warning)]">
                            No external ID
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <span className={statusChipClassName(order.status)}>{order.status}</span>
                      </td>
                      <td className="font-data px-4 py-3 text-right align-top text-xs tabular-nums text-[var(--admin-on-surface)]">
                        {formatAmount(order.amountCents, order.currency)}
                      </td>
                      <td className="font-data px-4 py-3 text-right align-top text-xs text-[var(--admin-on-surface-variant)]">
                        {formatTimestamp(order.createdAt)}
                      </td>
                      <td
                        className={`font-data px-4 py-3 text-right align-top text-xs ${
                          order.status === "paid" && order.paidAt === null
                            ? "text-[var(--admin-warning)]"
                            : "text-[var(--admin-on-surface-variant)]"
                        }`}
                      >
                        {formatTimestamp(order.paidAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col items-center gap-2 border-t border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-4 py-3">
            {nextCursor !== null ? (
              <button
                type="button"
                className={manageSecondaryButtonClassName}
                disabled={loadingMore}
                onClick={() => {
                  void loadMore();
                }}
              >
                {loadingMore ? (
                  <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden="true" />
                ) : null}
                {loadingMore ? "Loading…" : "Load more"}
              </button>
            ) : null}
            <p className="text-center text-xs text-[var(--admin-on-surface-variant)]">
              {/* Both facts are load-bearing: the operator needs to know this is
                  a window onto a larger ledger, and that they cannot re-sort it. */}
              Showing {String(orders.length)} of {String(summary?.total ?? orders.length)} orders.
              Sorted by created date, newest first — this order is fixed.
            </p>
          </div>
        </div>
      ) : null}

      {selectedOrders.length > 0 ? (
        <div className={ordersSelectionBarClassName}>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="text-sm font-semibold text-[var(--admin-on-surface)]">
              {String(selectedOrders.length)} {selectedOrders.length === 1 ? "order" : "orders"}{" "}
              selected
            </span>
            {/* One figure per currency. A combined total would be arithmetic on
                incomparable units. */}
            {totalsByCurrency(selectedOrders).map((entry) => (
              <span
                key={entry.currency}
                className="font-data text-xs tabular-nums text-[var(--admin-on-surface-variant)]"
              >
                {formatAmount(entry.amountCents, entry.currency)}
              </span>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={manageSecondaryButtonClassName}
              onClick={() => {
                exportRows(selectedOrders);
              }}
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Export selection
            </button>
            <button
              type="button"
              className={manageSecondaryButtonClassName}
              onClick={() => {
                setSelectedIds(new Set());
              }}
            >
              <X className="h-4 w-4" aria-hidden="true" />
              Clear
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SignalCard({
  label,
  value,
  loading,
  tone = "neutral",
  caption,
}: {
  label: string;
  value: number | undefined;
  loading: boolean;
  tone?: "neutral" | "warning";
  caption?: string;
}) {
  const warning = tone === "warning" && (value ?? 0) > 0;
  return (
    <div
      className={[
        ordersSignalCardClassName,
        warning
          ? "border-[color-mix(in_srgb,var(--admin-warning)_40%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_7%,var(--admin-surface))]"
          : "",
      ].join(" ")}
    >
      <span className={ordersSignalLabelClassName}>{label}</span>
      {loading ? (
        <span className="mt-2 block h-7 w-16 rounded bg-[var(--admin-surface-high)] motion-safe:animate-pulse" />
      ) : (
        <span
          className={`${ordersSignalValueClassName} ${
            warning ? "text-[var(--admin-warning)]" : ""
          }`}
        >
          {/* An em dash, never a zero: "0 failed" and "the totals did not load"
              are different claims, and only one of them is reassuring. */}
          {value === undefined ? "—" : value}
        </span>
      )}
      {caption && !loading && (value ?? 0) > 0 ? (
        <span className="mt-1 block text-[11px] text-[var(--admin-warning)]">{caption}</span>
      ) : null}
    </div>
  );
}
