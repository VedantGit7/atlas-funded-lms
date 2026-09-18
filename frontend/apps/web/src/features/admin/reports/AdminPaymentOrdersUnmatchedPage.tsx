"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Info,
  Plus,
  RotateCcw,
  ShieldAlert,
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
  fetchUnmatchedPaymentOrders,
  type PaymentOrder,
  type UnmatchedOrderGroup,
  type UnmatchedPaymentOrders,
} from "./payment-orders-api";
import {
  ORDER_FAULT_COPY,
  formatAge,
  formatAmount,
  formatTimestamp,
  ordersNoteClassName,
  ordersSignalCardClassName,
  ordersSignalLabelClassName,
  ordersSignalValueClassName,
  ordersTableHeadCellClassName,
  ordersTableShellClassName,
  statusChipClassName,
  unmatchedOrdersToCsv,
} from "./payment-orders-shared";

/**
 * `/admin/reports/payments/orders/unmatched`.
 *
 * The orders the ledger cannot settle by itself, grouped by why. Every figure
 * here is a ledger-wide scan: a reconciliation worklist assembled from the rows
 * a screen happened to load would report clean books while the stuck order sits
 * on page nine, which is worse than not asking at all. Only the row samples are
 * capped, and a group that was capped says so.
 *
 * Nothing on this screen mutates an order. Orders are never edited or deleted
 * here — the resolution is to record a separate manual order and leave the
 * original standing, so the audit trail survives the fix.
 */

const THRESHOLD_OPTIONS = [3, 7, 14, 30, 60];

const panelClassName =
  "admin-glass overflow-hidden rounded-xl border border-[var(--admin-border)] motion-safe:animate-[admin-fade-in_0.2s_ease-out]";

const countChipClassName =
  "font-data inline-flex items-center rounded-full border border-[color-mix(in_srgb,var(--admin-warning)_45%,transparent)] bg-[color-mix(in_srgb,var(--admin-warning)_14%,var(--admin-surface))] px-2.5 py-0.5 text-[11px] font-semibold tabular-nums text-[var(--admin-warning)]";

/** A worklist row is warm-tinted rather than red: stuck is not failed. */
const faultRowClassName =
  "group border-b border-[var(--admin-border)] bg-[color-mix(in_srgb,var(--admin-warning)_5%,transparent)] motion-safe:transition-colors hover:bg-[color-mix(in_srgb,var(--admin-warning)_10%,transparent)]";

function shortId(id: string): string {
  return id.slice(0, 8);
}

export function AdminPaymentOrdersUnmatchedPage() {
  const [stalePendingDays, setStalePendingDays] = useState(7);
  const [thresholdOpen, setThresholdOpen] = useState(false);

  const [data, setData] = useState<UnmatchedPaymentOrders | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const requestId = useRef(0);

  const load = useCallback(async (days: number, mode: "initial" | "refresh") => {
    const ticket = ++requestId.current;
    if (mode === "initial") setLoading(true);
    else setRefreshing(true);
    try {
      const next = await fetchUnmatchedPaymentOrders(days);
      // A result for a threshold the operator has already changed would name
      // the wrong rows as stale.
      if (ticket !== requestId.current) return;
      setData(next);
      setError(null);
    } catch (caught) {
      if (ticket !== requestId.current) return;
      setData(null);
      setError(
        caught instanceof ClientApiError ? caught.message : "The worklist could not be read.",
      );
    } finally {
      if (ticket === requestId.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    void load(stalePendingDays, "initial");
  }, [load, stalePendingDays]);

  const populated = useMemo(() => data?.groups.filter((entry) => entry.total > 0) ?? [], [data]);
  const anyTruncated = populated.some((entry) => entry.truncated);

  function exportWorklist() {
    if (data === null) return;
    const csv = unmatchedOrdersToCsv(populated);
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `unmatched-orders-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);

    const rows = populated.reduce((sum, entry) => sum + entry.items.length, 0);
    setNotice(
      anyTruncated
        ? `Exported ${String(rows)} rows — the oldest ${String(data.sampleLimit)} of each group. Some groups hold more than that; use the full ledger export to cover everything.`
        : `Exported ${String(rows)} ${rows === 1 ? "order" : "orders"}.`,
    );
  }

  const canRecord = data === null || data.capabilities.canRecord;

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
          <h1 className={managePageTitleClassName}>Unmatched orders</h1>
          <p className={managePageDescClassName}>
            Orders no webhook can settle, and orders whose status and timestamp disagree.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="w-44">
            <DropdownField
              label={
                <span
                  className="mb-1.5 block text-xs font-semibold text-[var(--admin-on-surface-variant)]"
                  id="stale-threshold-label"
                >
                  Pending longer than
                </span>
              }
              labelId="stale-threshold"
              open={thresholdOpen}
              panelAriaLabel="Stale pending threshold"
              onToggle={() => {
                setThresholdOpen((previous) => !previous);
              }}
              triggerContent={`${String(stalePendingDays)} days`}
            >
              <div className="flex flex-col gap-0.5 overflow-y-auto p-1.5">
                {/* Seven days is a default, not a fact: a tenant settling by
                    bank transfer is slower than one taking cards, so the
                    threshold is the operator's to set. */}
                {THRESHOLD_OPTIONS.map((days) => (
                  <button
                    key={days}
                    type="button"
                    role="option"
                    aria-selected={days === stalePendingDays}
                    className={dropdownItemClassName}
                    onClick={() => {
                      setStalePendingDays(days);
                      setThresholdOpen(false);
                    }}
                  >
                    {days} days
                  </button>
                ))}
              </div>
            </DropdownField>
          </div>
          <button
            type="button"
            className={manageSecondaryButtonClassName}
            disabled={loading || refreshing}
            onClick={() => {
              void load(stalePendingDays, "refresh");
            }}
          >
            <RotateCcw
              className={`h-4 w-4 ${refreshing ? "motion-safe:animate-spin" : ""}`}
              aria-hidden="true"
            />
            Refresh
          </button>
          <button
            type="button"
            className={manageSecondaryButtonClassName}
            disabled={populated.length === 0}
            onClick={exportWorklist}
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Export worklist
          </button>
          {/* Recording needs `config.update`, which reading this worklist does
              not imply, so the entry point is hidden when the server says the
              operator cannot use it. */}
          {canRecord ? (
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

      {error !== null ? (
        <PaymentOrdersErrorState
          message={error}
          retrying={refreshing}
          onRetry={() => {
            void load(stalePendingDays, "refresh");
          }}
        />
      ) : loading ? (
        <UnmatchedSkeleton />
      ) : data === null ? null : (
        <>
          <div className={ordersNoteClassName}>
            <Info
              className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-on-surface-variant)]"
              aria-hidden="true"
            />
            {/* The honest version of this note. Every count below is a scan of
                the whole ledger, not of a loaded page — which is the only way a
                reconciliation worklist means anything. */}
            <p className="text-sm text-[var(--admin-on-surface-variant)]">
              Every order in the ledger was scanned —{" "}
              <span className="font-data font-semibold text-[var(--admin-on-surface)]">
                {data.scannedTotal.toLocaleString()}
              </span>{" "}
              in total. Nothing on this screen changes an order; orders are never edited or deleted
              here, so the audit trail survives the fix.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <div className={ordersSignalCardClassName}>
              <span className={ordersSignalLabelClassName}>Needs attention</span>
              <span
                className={`${ordersSignalValueClassName} ${
                  data.affectedTotal > 0
                    ? "text-[var(--admin-warning)]"
                    : "text-[var(--admin-success)]"
                }`}
              >
                {data.affectedTotal.toLocaleString()}
              </span>
              <p className="mt-1 text-xs text-[var(--admin-on-surface-variant)]">
                {/* Distinct orders. An order stuck for two reasons appears in
                    two groups but is counted once here. */}
                distinct orders across {data.scannedTotal.toLocaleString()}
              </p>
            </div>

            {data.groups.map((entry) => (
              <div key={entry.fault} className={ordersSignalCardClassName}>
                <span className={ordersSignalLabelClassName}>
                  {ORDER_FAULT_COPY[entry.fault].title}
                </span>
                <span
                  className={`${ordersSignalValueClassName} ${
                    entry.total > 0 ? "text-[var(--admin-warning)]" : ""
                  }`}
                >
                  {entry.total.toLocaleString()}
                </span>
                {entry.fault === "stale-pending" ? (
                  <p className="mt-1 text-xs text-[var(--admin-on-surface-variant)]">
                    over {data.stalePendingDays} days
                  </p>
                ) : null}
              </div>
            ))}

            <div className={ordersSignalCardClassName}>
              <span className={ordersSignalLabelClassName}>Oldest</span>
              <span className={ordersSignalValueClassName}>
                {data.oldest === null ? "—" : formatAge(data.oldest.createdAt)}
              </span>
              {data.oldest !== null ? (
                <Link
                  href={`/admin/reports/payments/orders/${data.oldest.id}`}
                  className="font-data mt-1 inline-flex items-center gap-1 text-xs text-[var(--admin-primary)] hover:underline"
                >
                  {data.oldest.externalId ?? shortId(data.oldest.id)}
                  <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
                </Link>
              ) : null}
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            <div className="space-y-5 lg:col-span-2">
              {populated.length === 0 ? (
                <AllClearPanel days={data.stalePendingDays} />
              ) : (
                populated.map((entry) => (
                  <FaultGroupPanel key={entry.fault} group={entry} limit={data.sampleLimit} />
                ))
              )}
            </div>

            <aside className="lg:sticky lg:top-4 lg:self-start">
              <div className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-high)] p-5">
                <h2 className="text-sm font-bold text-[var(--admin-on-surface)]">
                  How these get fixed
                </h2>
                <div className="mt-4 space-y-5">
                  {data.groups.map((entry) => (
                    <div key={entry.fault}>
                      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                        {ORDER_FAULT_COPY[entry.fault].title}
                      </h3>
                      <p className="mt-1.5 text-sm text-[var(--admin-on-surface)]">
                        {ORDER_FAULT_COPY[entry.fault].remedy}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="mt-5 border-t border-[var(--admin-border)] pt-4">
                  {/* Real destinations only. There is no "ask the gateway"
                      action behind this screen, and a button implying one
                      would be a lie an operator acts on. */}
                  <Link
                    href="/admin/reports/payments/gateways"
                    className={`${manageSecondaryButtonClassName} w-full justify-center`}
                  >
                    Gateway settings
                  </Link>
                  <p className="mt-3 text-xs text-[var(--admin-on-surface-variant)]">
                    This console cannot query a gateway for a payment&apos;s true state — confirm
                    anything here against the gateway&apos;s own dashboard before recording it.
                  </p>
                </div>
              </div>
            </aside>
          </div>
        </>
      )}

      {notice !== null ? (
        <div
          role="status"
          className="flex items-start gap-3 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-4 py-3 motion-safe:animate-[admin-banner-in_0.18s_ease-out]"
        >
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

function FaultGroupPanel({ group, limit }: { group: UnmatchedOrderGroup; limit: number }) {
  const copy = ORDER_FAULT_COPY[group.fault];
  return (
    <section className={panelClassName}>
      <div className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-high)] p-5">
        <div className="flex flex-wrap items-center gap-3">
          <ShieldAlert className="h-4 w-4 text-[var(--admin-warning)]" aria-hidden="true" />
          <h2 className="text-sm font-bold text-[var(--admin-on-surface)]">{copy.title}</h2>
          <span className={countChipClassName}>{group.total.toLocaleString()}</span>
        </div>
        <p className="mt-2 text-sm text-[var(--admin-on-surface-variant)]">{copy.why}</p>
        {group.truncated ? (
          <p className="mt-2 text-sm font-semibold text-[var(--admin-warning)]">
            {/* Never let a capped sample read as the whole group. */}
            Showing the {limit} oldest of {group.total.toLocaleString()}.
          </p>
        ) : null}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-left">
          <thead className="border-b border-[var(--admin-border)] bg-[var(--admin-surface)]">
            <tr>
              <th className={ordersTableHeadCellClassName}>Created</th>
              <th className={`${ordersTableHeadCellClassName} text-right`}>Amount</th>
              <th className={ordersTableHeadCellClassName}>Status</th>
              <th className={ordersTableHeadCellClassName}>External ID</th>
              <th className={ordersTableHeadCellClassName}>Age</th>
              <th className={ordersTableHeadCellClassName}>
                <span className="sr-only">Open</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {group.items.map((order) => (
              <WorklistRow key={order.id} order={order} fault={group.fault} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function WorklistRow({ order, fault }: { order: PaymentOrder; fault: string }) {
  const missingExternalId = order.externalId === null || order.externalId.trim() === "";
  return (
    <tr className={faultRowClassName}>
      <td className="font-data whitespace-nowrap px-4 py-2.5 text-sm text-[var(--admin-on-surface)]">
        {formatTimestamp(order.createdAt)}
      </td>
      <td className="font-data whitespace-nowrap px-4 py-2.5 text-right text-sm tabular-nums text-[var(--admin-on-surface)]">
        {formatAmount(order.amountCents, order.currency)}
      </td>
      <td className="px-4 py-2.5">
        <span className={statusChipClassName(order.status)}>{order.status}</span>
      </td>
      <td className="font-data whitespace-nowrap px-4 py-2.5 text-sm">
        {missingExternalId ? (
          <span className="text-[var(--admin-warning)]">None</span>
        ) : (
          <span className="text-[var(--admin-on-surface-variant)]">{order.externalId}</span>
        )}
      </td>
      <td className="font-data whitespace-nowrap px-4 py-2.5 text-sm text-[var(--admin-on-surface-variant)]">
        {fault === "paid-without-timestamp" ? "—" : formatAge(order.createdAt)}
      </td>
      <td className="whitespace-nowrap px-4 py-2.5 text-right">
        {/* A real destination rather than an overflow menu with nothing behind
            it: the order's own page is where the remaining detail lives. */}
        <Link
          href={`/admin/reports/payments/orders/${order.id}`}
          className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--admin-primary)] hover:underline"
        >
          Open
          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </td>
    </tr>
  );
}

/** Nothing in the ledger is stuck. */
function AllClearPanel({ days }: { days: number }) {
  return (
    <div className="admin-glass flex flex-col items-center rounded-xl border border-dashed border-[var(--admin-outline)] px-6 py-16 text-center motion-safe:animate-[admin-fade-in_0.2s_ease-out]">
      <span className="mb-5 inline-flex h-16 w-16 items-center justify-center rounded-full border border-[color-mix(in_srgb,var(--admin-success)_35%,transparent)] bg-[color-mix(in_srgb,var(--admin-success)_12%,var(--admin-surface))] text-[var(--admin-success)]">
        <CheckCircle2 className="h-7 w-7" aria-hidden="true" />
      </span>
      <h2 className="text-lg font-bold text-[var(--admin-on-surface)]">All clear</h2>
      <ul className="mt-5 space-y-2.5 text-left">
        {[
          "No orders without an external ID",
          `Nothing pending beyond ${String(days)} days`,
          "No orders marked paid without a settlement time",
        ].map((line) => (
          <li key={line} className="flex items-center gap-2.5">
            <Check className="h-4 w-4 shrink-0 text-[var(--admin-success)]" aria-hidden="true" />
            <span className="text-sm text-[var(--admin-on-surface-variant)]">{line}</span>
          </li>
        ))}
      </ul>
      <p className="mt-6 text-sm text-[var(--admin-on-surface-variant)]">
        {/* The claim is about the ledger, not about a page of it. */}
        Nothing in the ledger needs reconciling.
      </p>
    </div>
  );
}

function UnmatchedSkeleton() {
  return (
    <div className="space-y-5" aria-hidden="true">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className={ordersSignalCardClassName}>
            <div className="h-3 w-24 rounded bg-[var(--admin-surface-high)] motion-safe:animate-pulse" />
            <div className="mt-3 h-7 w-16 rounded bg-[var(--admin-surface-high)] motion-safe:animate-pulse" />
          </div>
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {Array.from({ length: 2 }, (_, panel) => (
            <div key={panel} className={ordersTableShellClassName}>
              <div className="space-y-2 border-b border-[var(--admin-border)] bg-[var(--admin-surface-high)] p-5">
                <div className="h-4 w-40 rounded bg-[var(--admin-surface)] motion-safe:animate-pulse" />
                <div className="h-3 w-3/4 rounded bg-[var(--admin-surface)] motion-safe:animate-pulse" />
              </div>
              {Array.from({ length: 4 }, (_, row) => (
                <div
                  key={row}
                  className="flex items-center gap-4 border-b border-[var(--admin-border)] px-4 py-3"
                >
                  <div
                    className="h-3.5 rounded bg-[var(--admin-surface-high)] motion-safe:animate-pulse"
                    style={{ width: `${String(18 + ((row * 5) % 10))}%` }}
                  />
                  <div className="h-3.5 w-20 rounded bg-[var(--admin-surface-high)] motion-safe:animate-pulse" />
                  <div className="h-5 w-16 rounded-md bg-[var(--admin-surface-high)] motion-safe:animate-pulse" />
                  <div className="ml-auto h-3.5 w-24 rounded bg-[var(--admin-surface-high)] motion-safe:animate-pulse" />
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-high)] p-5">
          <div className="h-4 w-36 rounded bg-[var(--admin-surface)] motion-safe:animate-pulse" />
          <div className="mt-4 space-y-3">
            {Array.from({ length: 6 }, (_, line) => (
              <div
                key={line}
                className="h-3 rounded bg-[var(--admin-surface)] motion-safe:animate-pulse"
                style={{ width: `${String(60 + ((line * 7) % 35))}%` }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
