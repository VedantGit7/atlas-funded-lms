"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Copy,
  ExternalLink,
  FileText,
  Info,
  ReceiptText,
  SearchX,
  Undo2,
  User,
} from "lucide-react";
import { ClientApiError } from "../../../lib/client-api";
import {
  managePageTitleClassName,
  managePrimaryButtonClassName,
  manageSecondaryButtonClassName,
} from "../manage/manage-ui-shared";
import { fetchPaymentOrder, type PaymentOrderDetail } from "./payment-orders-api";
import {
  formatAmount,
  formatTimestamp,
  manualEntryNote,
  orderChecks,
  ordersEmptyPanelClassName,
  ordersNoteClassName,
  statusChipClassName,
} from "./payment-orders-shared";

const ORDERS_HREF = "/admin/reports/payments/orders";

const panelClassName = "rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)]";
const panelHeaderClassName =
  "flex items-center justify-between gap-3 border-b border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-4 py-3";
const cellLabelClassName =
  "text-[11px] font-semibold uppercase tracking-wide text-[var(--admin-on-surface-variant)]";

/**
 * `/admin/reports/payments/orders/[orderId]`.
 *
 * One ledger row, and everything derivable about whether it is sound. The
 * design brief for this screen described it as assembled from the ledger list —
 * "there is no single-order endpoint yet" — which made an order further back in
 * the cursor-paginated history indistinguishable from one that never existed.
 * `GET /api/v1/payments/orders/[orderId]` now exists, so a not-found here means
 * not found.
 *
 * The screen states two limits plainly rather than implying otherwise: orders
 * cannot be edited or deleted through this console, and nothing here can tell
 * you a webhook settled an order — only that the row says so, unless the order
 * carries a manual-entry note, in which case a person wrote it.
 */
export function AdminPaymentOrderDetailPage({ orderId }: { orderId: string }) {
  const [order, setOrder] = useState<PaymentOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setNotFound(false);
    setError(null);
    try {
      setOrder(await fetchPaymentOrder(orderId));
    } catch (caught) {
      if (caught instanceof ClientApiError && caught.status === 404) {
        setNotFound(true);
      } else {
        setError(caught instanceof ClientApiError ? caught.message : "Could not load the order.");
      }
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    void load();
  }, [load]);

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

  const breadcrumb = (
    <nav aria-label="Breadcrumb" className="font-data flex items-center gap-1.5 text-xs">
      <Link
        href={ORDERS_HREF}
        className="text-[var(--admin-on-surface-variant)] transition-colors hover:text-[var(--admin-primary)]"
      >
        Orders
      </Link>
      <ChevronRight className="h-3 w-3 text-[var(--admin-on-surface-variant)]" aria-hidden="true" />
      <span className="truncate font-semibold text-[var(--admin-on-surface)]">{orderId}</span>
    </nav>
  );

  if (loading) return <OrderDetailSkeleton />;

  if (notFound) {
    return (
      <div className="space-y-5">
        {breadcrumb}
        <div className={ordersEmptyPanelClassName}>
          <span className="mb-5 inline-flex h-16 w-16 items-center justify-center rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]">
            <SearchX className="h-7 w-7" aria-hidden="true" />
          </span>
          <h1 className="text-lg font-bold text-[var(--admin-on-surface)]">No such order</h1>
          {/* A real lookup, so this is a fact rather than "not on this page". */}
          <p className="mt-2 max-w-md text-sm text-[var(--admin-on-surface-variant)]">
            No order with this ID exists in this academy&apos;s ledger. The link that brought you
            here may be stale, or the ID may belong to a different academy.
          </p>
          <Link href={ORDERS_HREF} className={`${managePrimaryButtonClassName} mt-6`}>
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to orders
          </Link>
        </div>
      </div>
    );
  }

  if (error !== null || order === null) {
    return (
      <div className="space-y-4">
        {breadcrumb}
        <p
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-[var(--admin-danger)] bg-[color-mix(in_srgb,var(--admin-danger)_10%,var(--admin-surface))] px-3 py-2 text-sm font-medium text-[var(--admin-danger)]"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {error ?? "Could not load the order."}
        </p>
        <button
          type="button"
          className={manageSecondaryButtonClassName}
          onClick={() => {
            void load();
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  const checks = orderChecks(order);
  const failed = checks.filter((check) => check.status === "fail");
  const note = manualEntryNote(order.metadataJson);
  const hasExternalId = order.externalId !== null && order.externalId.trim() !== "";

  const rawRecord: Array<[string, string]> = [
    ["id", JSON.stringify(order.id)],
    ["membershipId", JSON.stringify(order.membershipId)],
    ["externalId", JSON.stringify(order.externalId)],
    ["amountCents", String(order.amountCents)],
    ["currency", JSON.stringify(order.currency)],
    ["status", JSON.stringify(order.status)],
    ["gatewayKey", JSON.stringify(order.gatewayKey)],
    ["productTitle", JSON.stringify(order.productTitle)],
    ["invoiceNumber", JSON.stringify(order.invoiceNumber)],
    ["billingName", JSON.stringify(order.billingName)],
    ["couponAmountCents", JSON.stringify(order.couponAmountCents)],
    ["taxAmountCents", JSON.stringify(order.taxAmountCents)],
    ["paidAt", JSON.stringify(order.paidAt)],
    ["createdAt", JSON.stringify(order.createdAt)],
    ["updatedAt", JSON.stringify(order.updatedAt)],
    ["metadataJson", JSON.stringify(order.metadataJson)],
  ];

  return (
    <div className="space-y-5">
      {breadcrumb}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className={`${managePageTitleClassName} font-data break-all`}>{order.id}</h1>
            <span className={statusChipClassName(order.status)}>{order.status}</span>
          </div>
          <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
            {order.currency} · created {formatTimestamp(order.createdAt)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={manageSecondaryButtonClassName}
            onClick={() => {
              copyValue(order.id, "order ID");
            }}
          >
            <Copy className="h-4 w-4" aria-hidden="true" />
            Copy order ID
          </button>
          {hasExternalId ? (
            <button
              type="button"
              className={manageSecondaryButtonClassName}
              onClick={() => {
                copyValue(order.externalId ?? "", "external ID");
              }}
            >
              <Copy className="h-4 w-4" aria-hidden="true" />
              Copy external ID
            </button>
          ) : null}
          {/* The ledger row records whether an invoice was raised, so the link
              is offered only when there is a document to open. */}
          {order.invoiceNumber !== null ? (
            <Link
              href={`${ORDERS_HREF}/${order.id}/invoice`}
              className={manageSecondaryButtonClassName}
            >
              <FileText className="h-4 w-4" aria-hidden="true" />
              Invoice
            </Link>
          ) : null}
          {/* Offered only for a settled payment: there is nothing to reverse on
              a pending or failed order, and the refund screen itself re-checks
              the refundable balance against the transaction. */}
          {order.status === "paid" ? (
            <Link
              href={`${ORDERS_HREF}/${order.id}/refund`}
              className={manageSecondaryButtonClassName}
            >
              <Undo2 className="h-4 w-4" aria-hidden="true" />
              Refund
            </Link>
          ) : null}
          {/* Orders are immutable here, so a mistake is answered with another
              entry rather than an edit. */}
          <Link href={`${ORDERS_HREF}/new`} className={managePrimaryButtonClassName}>
            <ReceiptText className="h-4 w-4" aria-hidden="true" />
            Record a reconciling order
          </Link>
        </div>
      </div>

      {notice ? (
        <p
          role="status"
          className="rounded-lg border border-[color-mix(in_srgb,var(--admin-success)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-success)_10%,var(--admin-surface))] px-3 py-2 text-sm font-medium text-[var(--admin-success)]"
        >
          {notice}
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <div className="space-y-5 lg:col-span-8">
          <section
            className={[
              panelClassName,
              "overflow-hidden",
              failed.length > 0
                ? "border-l-4 border-l-[var(--admin-warning)]"
                : "border-l-4 border-l-[var(--admin-success)]",
            ].join(" ")}
          >
            <div className="border-b border-[var(--admin-border)] p-6">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="font-data text-3xl font-light tabular-nums text-[var(--admin-on-surface)]">
                  {formatAmount(order.amountCents, order.currency)}
                </span>
              </div>
              <p className="font-data mt-1 text-xs text-[var(--admin-on-surface-variant)]">
                {/* The stored value, so an operator reconciling against a
                    gateway export can compare like with like. */}
                {String(order.amountCents)} minor units
                {order.taxAmountCents !== null ? ` · tax ${String(order.taxAmountCents)}` : ""}
                {order.couponAmountCents !== null
                  ? ` · coupon ${String(order.couponAmountCents)}`
                  : ""}
              </p>
            </div>

            <dl className="grid grid-cols-2 divide-x divide-y divide-[var(--admin-border)] md:grid-cols-4 md:divide-y-0">
              <div className="p-4">
                <dt className={cellLabelClassName}>Status</dt>
                <dd className="mt-1 text-sm capitalize text-[var(--admin-on-surface)]">
                  {order.status}
                </dd>
              </div>
              <div className="p-4">
                <dt className={cellLabelClassName}>Created</dt>
                <dd className="font-data mt-1 text-xs text-[var(--admin-on-surface)]">
                  {formatTimestamp(order.createdAt)}
                </dd>
              </div>
              <div className="p-4">
                <dt className={cellLabelClassName}>Paid at</dt>
                <dd
                  className={`font-data mt-1 text-xs ${
                    order.status === "paid" && order.paidAt === null
                      ? "text-[var(--admin-warning)]"
                      : "text-[var(--admin-on-surface)]"
                  }`}
                >
                  {formatTimestamp(order.paidAt)}
                </dd>
              </div>
              <div className="p-4">
                <dt className={cellLabelClassName}>Membership</dt>
                <dd className="font-data mt-1 break-all text-xs text-[var(--admin-on-surface)]">
                  {order.membershipId ?? "—"}
                </dd>
              </div>
            </dl>
          </section>

          <section className={panelClassName}>
            <div className={panelHeaderClassName}>
              <h2 className="text-sm font-bold text-[var(--admin-on-surface)]">Settlement</h2>
              {hasExternalId ? (
                <span className="font-data flex items-center gap-1.5 rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface)] px-2 py-1 text-[11px] text-[var(--admin-on-surface-variant)]">
                  <span className="max-w-[16rem] truncate">{order.externalId}</span>
                  <button
                    type="button"
                    aria-label="Copy external ID"
                    className="rounded p-0.5 transition-colors hover:text-[var(--admin-primary)]"
                    onClick={() => {
                      copyValue(order.externalId ?? "", "external ID");
                    }}
                  >
                    <Copy className="h-3 w-3" aria-hidden="true" />
                  </button>
                </span>
              ) : null}
            </div>

            <div className="space-y-5 p-5">
              {!hasExternalId ? (
                <div className="flex items-start gap-3 rounded-xl border border-[color-mix(in_srgb,var(--admin-warning)_32%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_9%,var(--admin-surface))] px-4 py-3">
                  <AlertTriangle
                    className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-warning)]"
                    aria-hidden="true"
                  />
                  <div>
                    <p className="text-sm font-semibold text-[var(--admin-on-surface)]">
                      No external ID
                    </p>
                    <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
                      Gateway webhooks find an order by its external ID. Nothing will settle this
                      order automatically.
                    </p>
                  </div>
                </div>
              ) : null}

              {note !== null ? (
                <div className="flex items-start gap-3 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-4 py-3">
                  <User
                    className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-on-surface-variant)]"
                    aria-hidden="true"
                  />
                  <div>
                    {/* The one signal that separates a human-written row from a
                        gateway-settled one. Without it, the screen does not
                        claim a webhook did anything. */}
                    <p className="text-sm font-semibold text-[var(--admin-on-surface)]">
                      Recorded manually
                    </p>
                    <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">{note}</p>
                  </div>
                </div>
              ) : null}

              <div>
                <h3 className={`${cellLabelClassName} mb-2`}>Consistency checks</h3>
                <ul className="divide-y divide-[var(--admin-border)] rounded-lg border border-[var(--admin-border)]">
                  {checks.map((check) => (
                    <li key={check.key} className="px-3 py-2.5">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm text-[var(--admin-on-surface)]">
                          {check.label}
                        </span>
                        <span
                          className={`font-data flex shrink-0 items-center gap-1 text-[11px] font-semibold uppercase ${
                            check.status === "pass"
                              ? "text-[var(--admin-success)]"
                              : "text-[var(--admin-warning)]"
                          }`}
                        >
                          {check.status === "pass" ? (
                            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                          ) : (
                            <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                          )}
                          {check.status}
                        </span>
                      </div>
                      {/* Shown only on failure: a passing check needs no essay. */}
                      {check.status === "fail" ? (
                        <p className="mt-1 text-xs text-[var(--admin-warning)]">{check.detail}</p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <p className="flex items-start gap-2 border-t border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-4 py-3 text-xs text-[var(--admin-on-surface-variant)]">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              Orders cannot be edited or deleted here. To correct one, record a reconciling order
              and reference this order&apos;s ID in its reason.
            </p>
          </section>

          <section className={panelClassName}>
            <div className={panelHeaderClassName}>
              <h2 className="text-sm font-bold text-[var(--admin-on-surface)]">Raw record</h2>
              <button
                type="button"
                className={manageSecondaryButtonClassName}
                onClick={() => {
                  copyValue(JSON.stringify(order, null, 2), "the raw record");
                }}
              >
                <Copy className="h-4 w-4" aria-hidden="true" />
                Copy JSON
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <caption className="sr-only">The stored order record, field by field.</caption>
                <tbody>
                  {rawRecord.map(([key, value]) => (
                    <tr key={key} className="border-b border-[var(--admin-border)] last:border-b-0">
                      <th
                        scope="row"
                        className="font-data w-1/3 px-4 py-2 text-left text-xs font-normal text-[var(--admin-on-surface-variant)]"
                      >
                        {key}
                      </th>
                      <td
                        className={`font-data px-4 py-2 text-xs break-all ${
                          value === "null"
                            ? "text-[var(--admin-on-surface-variant)]"
                            : "text-[var(--admin-on-surface)]"
                        }`}
                      >
                        {value}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <div className="space-y-5 lg:col-span-4">
          <section className={panelClassName}>
            <div className={panelHeaderClassName}>
              <h2 className="text-sm font-bold text-[var(--admin-on-surface)]">Related</h2>
            </div>
            <div className="divide-y divide-[var(--admin-border)]">
              {/* Transactions keys its detail route on the same id as the order,
                  so this deep-links to the matching transaction rather than
                  dropping the operator at the top of the list. That page is
                  also where refunding lives: it holds the product and gateway
                  detail a refund needs, which the raw ledger row does not. */}
              <Link
                href={`/admin/reports/payments/transactions/${order.id}`}
                className="group flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-[var(--admin-surface-high)]"
              >
                <span className="flex items-center gap-3">
                  <ExternalLink
                    className="h-4 w-4 text-[var(--admin-on-surface-variant)]"
                    aria-hidden="true"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm text-[var(--admin-on-surface)]">
                      Open in Transactions
                    </span>
                    <span className="block text-[11px] text-[var(--admin-on-surface-variant)]">
                      Refunds are issued there
                    </span>
                  </span>
                </span>
                <ChevronRight
                  className="h-4 w-4 text-[var(--admin-on-surface-variant)] transition-transform group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </Link>

              {order.membershipId !== null ? (
                <Link
                  href={`/admin/members/${order.membershipId}`}
                  className="group flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-[var(--admin-surface-high)]"
                >
                  <span className="flex items-center gap-3">
                    <User
                      className="h-4 w-4 text-[var(--admin-on-surface-variant)]"
                      aria-hidden="true"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm text-[var(--admin-on-surface)]">
                        Member profile
                      </span>
                      <span className="font-data block truncate text-[11px] text-[var(--admin-on-surface-variant)]">
                        {order.membershipId}
                      </span>
                    </span>
                  </span>
                  <ChevronRight
                    className="h-4 w-4 text-[var(--admin-on-surface-variant)] transition-transform group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </Link>
              ) : (
                <p className="px-4 py-3 text-sm text-[var(--admin-on-surface-variant)]">
                  No membership is attached to this order.
                </p>
              )}
            </div>
          </section>

          {order.gatewayKey !== null ||
          order.productTitle !== null ||
          order.invoiceNumber !== null ||
          order.billingName !== null ? (
            <section className={panelClassName}>
              <div className={panelHeaderClassName}>
                <h2 className="text-sm font-bold text-[var(--admin-on-surface)]">Commerce</h2>
              </div>
              <dl className="divide-y divide-[var(--admin-border)]">
                {[
                  ["Gateway", order.gatewayKey],
                  ["Product", order.productTitle],
                  ["Invoice", order.invoiceNumber],
                  ["Billed to", order.billingName],
                ]
                  // Only what is actually recorded: an empty row here reads as
                  // missing data rather than as a field nobody filled in.
                  .filter(([, value]) => value !== null)
                  .map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-3 px-4 py-2.5">
                      <dt className={cellLabelClassName}>{label}</dt>
                      <dd className="font-data min-w-0 truncate text-xs text-[var(--admin-on-surface)]">
                        {value}
                      </dd>
                    </div>
                  ))}
              </dl>
            </section>
          ) : null}

          <div className={ordersNoteClassName}>
            <FileText
              className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-on-surface-variant)]"
              aria-hidden="true"
            />
            <p className="text-sm text-[var(--admin-on-surface-variant)]">
              This is the raw ledger row. Learner, product and gateway detail as it is presented to
              finance lives in Transactions.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function OrderDetailSkeleton() {
  return (
    <div className="space-y-5" aria-hidden="true">
      <div className="h-3 w-40 rounded bg-[var(--admin-surface-high)] motion-safe:animate-pulse" />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="h-7 w-72 rounded bg-[var(--admin-surface-high)] motion-safe:animate-pulse" />
          <div className="h-3 w-48 rounded bg-[var(--admin-surface-high)] motion-safe:animate-pulse" />
        </div>
        <div className="flex gap-2">
          <div className="h-10 w-32 rounded-lg bg-[var(--admin-surface-high)] motion-safe:animate-pulse" />
          <div className="h-10 w-44 rounded-lg bg-[var(--admin-surface-high)] motion-safe:animate-pulse" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <div className="space-y-5 lg:col-span-8">
          <div className="h-40 rounded-xl bg-[var(--admin-surface-high)] motion-safe:animate-pulse" />
          <div className="h-72 rounded-xl bg-[var(--admin-surface-high)] motion-safe:animate-pulse" />
          <div className="h-80 rounded-xl bg-[var(--admin-surface-high)] motion-safe:animate-pulse" />
        </div>
        <div className="space-y-5 lg:col-span-4">
          <div className="h-40 rounded-xl bg-[var(--admin-surface-high)] motion-safe:animate-pulse" />
          <div className="h-32 rounded-xl bg-[var(--admin-surface-high)] motion-safe:animate-pulse" />
        </div>
      </div>
    </div>
  );
}
