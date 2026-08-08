"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  Info,
  RefreshCw,
  Search,
  Undo2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ClientApiError } from "../../../lib/client-api";
import {
  exportPaymentTransactions,
  fetchPaymentRefunds,
  fetchPaymentTransactionDetail,
  type PaymentRefundLedgerItem,
  type PaymentRefundsList,
  type PaymentRefundsQueue,
  type PaymentTransactionDetail,
} from "./admin-payments-roster-api";
import {
  downloadReportExport,
  pollReportRunUntilComplete,
} from "./admin-reports-api";
import { AdminPaymentRefundModal } from "./AdminPaymentRefundModal";
import { PaymentsReportTabs } from "./PaymentsReportTabs";

const PAGE_SIZE = 20;

const QUEUES: Array<{
  key: PaymentRefundsQueue | "disputes";
  label: string;
  countKey?: keyof PaymentRefundsList["summary"];
}> = [
  { key: "refundable", label: "Refundable", countKey: "refundableCount" },
  { key: "partial", label: "Partially refunded", countKey: "partialCount" },
  { key: "refunded", label: "Fully refunded", countKey: "refundedCount" },
  { key: "all", label: "All ledger" },
  { key: "disputes", label: "Disputes / CBKs" },
];

function formatMoney(cents: number, currency: string): string {
  return `${(cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`;
}

function formatRelative(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  const deltaMs = Date.now() - date.getTime();
  const hours = Math.floor(deltaMs / (60 * 60 * 1000));
  if (hours < 1) return "just now";
  if (hours < 48) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function reasonLabel(reason: string): string {
  switch (reason) {
    case "duplicate":
      return "Duplicate";
    case "fraudulent":
      return "Fraudulent";
    case "customer_requested":
      return "Customer requested";
    default:
      return reason.replace(/_/g, " ");
  }
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

function RefundDetailDrawer({
  orderId,
  onClose,
  onIssueRefund,
}: {
  orderId: string;
  onClose: () => void;
  onIssueRefund: (detail: PaymentTransactionDetail) => void;
}) {
  const [detail, setDetail] = useState<PaymentTransactionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetchPaymentTransactionDetail(orderId)
      .then((response) => {
        if (!cancelled) setDetail(response.data);
      })
      .catch((err) => {
        if (!cancelled) {
          setDetail(null);
          setError(
            err instanceof ClientApiError
              ? err.message
              : err instanceof Error
                ? err.message
                : "Unable to load transaction.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60] flex justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-[color-mix(in_srgb,var(--admin-bg)_70%,transparent)] backdrop-blur-[2px]"
        aria-label="Close drawer"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Refund details"
        className="admin-theme relative z-10 flex h-full w-full max-w-[600px] flex-col border-l border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-2xl motion-safe:animate-[admin-dropdown-in_0.2s_cubic-bezier(0.16,1,0.3,1)]"
      >
        <div className="flex items-center justify-between border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-6">
          <h2 className="text-xl font-semibold text-[var(--admin-on-surface)]">
            Refund details
          </h2>
          <button
            type="button"
            className="rounded border border-transparent p-2 text-[var(--admin-on-surface-variant)] hover:border-[var(--admin-border)] hover:text-[var(--admin-on-surface)]"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="space-y-3">
              <Shimmer className="h-24 w-full" />
              <Shimmer className="h-32 w-full" />
              <Shimmer className="h-40 w-full" />
            </div>
          ) : null}
          {error ? (
            <p role="alert" className="text-sm text-[var(--admin-danger)]">
              {error}
            </p>
          ) : null}
          {detail ? (
            <div className="space-y-6">
              <section className="overflow-hidden rounded border border-[var(--admin-border)] bg-[var(--admin-surface-high)]">
                <div className="flex items-center gap-2 border-b border-[var(--admin-border)] bg-[var(--admin-surface-variant)] px-4 py-2">
                  <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                    Original transaction
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-4 p-4">
                  <div>
                    <p className="font-mono text-[10px] uppercase text-[var(--admin-on-surface-variant)]">
                      Amount
                    </p>
                    <p className="font-mono text-sm text-[var(--admin-on-surface)]">
                      {formatMoney(detail.amountCents, detail.currency)}
                    </p>
                  </div>
                  <div>
                    <p className="font-mono text-[10px] uppercase text-[var(--admin-on-surface-variant)]">
                      Gateway
                    </p>
                    <p className="font-mono text-sm text-[var(--admin-on-surface)]">
                      {detail.gatewayKey ?? "—"}
                    </p>
                  </div>
                  <div>
                    <p className="font-mono text-[10px] uppercase text-[var(--admin-on-surface-variant)]">
                      Date
                    </p>
                    <p className="font-mono text-sm text-[var(--admin-on-surface)]">
                      {formatDateTime(detail.paidAt ?? detail.createdAt)}
                    </p>
                  </div>
                  <div>
                    <p className="font-mono text-[10px] uppercase text-[var(--admin-on-surface-variant)]">
                      Invoice
                    </p>
                    {detail.invoiceNumber ? (
                      <Link
                        href={`/admin/reports/payments/transactions/${detail.id}`}
                        className="inline-flex items-center gap-1 font-mono text-sm text-[var(--admin-primary)] hover:underline"
                      >
                        {detail.invoiceNumber}
                        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                      </Link>
                    ) : (
                      <p className="font-mono text-sm text-[var(--admin-on-surface-variant)]">—</p>
                    )}
                  </div>
                </div>
              </section>

              <section className="overflow-hidden rounded border border-[var(--admin-border)] bg-[var(--admin-surface-high)]">
                <div className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-variant)] px-4 py-2">
                  <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                    Refund balance
                  </span>
                </div>
                <div className="space-y-3 p-4">
                  <div className="flex justify-between font-mono text-sm">
                    <span className="text-[var(--admin-on-surface-variant)]">Refunded to date</span>
                    <span className="text-[var(--admin-on-surface)]">
                      {formatMoney(detail.refundedAmountCents, detail.currency)}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-[var(--admin-border)] pt-3 font-mono text-sm">
                    <span className="text-[var(--admin-on-surface-variant)]">Still refundable</span>
                    <span className="font-bold text-[var(--admin-on-surface)]">
                      {formatMoney(detail.refundableAmountCents, detail.currency)}
                    </span>
                  </div>
                </div>
              </section>

              <section>
                <h3 className="mb-2 font-mono text-[10px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                  Impact
                </h3>
                {detail.product.courseId ? (
                  <div className="flex items-start gap-2 border border-[color-mix(in_srgb,var(--admin-warning)_25%,transparent)] bg-[color-mix(in_srgb,var(--admin-warning)_8%,transparent)] p-3 text-sm text-[var(--admin-warning)]">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    <p>
                      Issuing a refund with access revocation will remove enrollment for{" "}
                      <span className="font-semibold text-[var(--admin-on-surface)]">
                        {detail.product.title ?? "this product"}
                      </span>
                      .
                    </p>
                  </div>
                ) : (
                  <p className="rounded border border-dashed border-[var(--admin-border)] p-3 text-sm text-[var(--admin-on-surface-variant)]">
                    No linked course enrollment on this order.
                  </p>
                )}
              </section>

              <section>
                <h3 className="mb-2 font-mono text-[10px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                  Recorded refunds
                </h3>
                {detail.refunds.length === 0 ? (
                  <p className="rounded border border-dashed border-[var(--admin-border)] p-4 text-sm text-[var(--admin-on-surface-variant)]">
                    No refunds recorded on this order yet.
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {detail.refunds.map((refund) => (
                      <li
                        key={refund.id}
                        className="rounded border border-[var(--admin-border)] bg-[var(--admin-surface-high)] p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-mono text-sm text-[var(--admin-on-surface)]">
                              {formatMoney(refund.amountCents, detail.currency)} ·{" "}
                              {reasonLabel(refund.reason)}
                            </p>
                            {refund.note ? (
                              <p className="mt-2 text-sm italic text-[var(--admin-on-surface-variant)]">
                                “{refund.note}”
                              </p>
                            ) : null}
                          </div>
                          <span className="font-mono text-[10px] text-[var(--admin-on-surface-variant)]">
                            {formatDateTime(refund.createdAt)}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <div className="flex gap-2 rounded border border-[color-mix(in_srgb,var(--admin-warning)_25%,transparent)] bg-[color-mix(in_srgb,var(--admin-warning)_8%,transparent)] p-3 text-sm text-[var(--admin-warning)]">
                <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <p>
                  Refunds are recorded on the LMS ledger. Process the matching reverse on your
                  payment gateway if required; automated gateway refunds are not wired yet.
                </p>
              </div>
            </div>
          ) : null}
        </div>

        {detail ? (
          <div className="flex items-center gap-3 border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-6">
            <Link
              href={`/admin/reports/payments/transactions/${detail.id}`}
              className="flex-1 rounded border border-[var(--admin-border)] bg-[var(--admin-surface)] py-3 text-center font-mono text-xs font-bold uppercase tracking-wide text-[var(--admin-on-surface)] hover:border-[var(--admin-primary)]"
            >
              Open transaction
            </Link>
            {detail.canRefund ? (
              <button
                type="button"
                className="flex-[2] rounded bg-[var(--admin-danger)] py-3 font-mono text-xs font-bold uppercase tracking-wide text-[var(--admin-on-primary)] shadow-[0_0_12px_color-mix(in_srgb,var(--admin-danger)_25%,transparent)]"
                onClick={() => onIssueRefund(detail)}
              >
                Issue refund — {formatMoney(detail.refundableAmountCents, detail.currency)}
              </button>
            ) : null}
          </div>
        ) : null}
      </aside>
    </div>
  );
}

export function AdminPaymentsRefundsLedgerPage() {
  const [queue, setQueue] = useState<PaymentRefundsQueue | "disputes">("refundable");
  const [search, setSearch] = useState("");
  const [searchApplied, setSearchApplied] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<PaymentRefundsList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [drawerOrderId, setDrawerOrderId] = useState<string | null>(null);
  const [refundDetail, setRefundDetail] = useState<PaymentTransactionDetail | null>(null);

  const activeQueue: PaymentRefundsQueue = queue === "disputes" ? "all" : queue;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (queue === "disputes") {
        const response = await fetchPaymentRefunds({
          queue: "all",
          page: 1,
          limit: 1,
          sortBy: "paid_at",
          sortDir: "desc",
        });
        setData({
          ...response.data,
          items: [],
          pageInfo: {
            ...response.data.pageInfo,
            totalCount: 0,
            totalPages: 0,
            hasNextPage: false,
            hasPreviousPage: false,
          },
        });
        setSelectedIds(new Set());
        return;
      }
      const response = await fetchPaymentRefunds({
        queue: activeQueue,
        q: searchApplied || undefined,
        page,
        limit: PAGE_SIZE,
        sortBy: "paid_at",
        sortDir: "desc",
      });
      setData(response.data);
      setSelectedIds(new Set());
    } catch (err) {
      setData(null);
      setError(
        err instanceof ClientApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Unable to load refunds.",
      );
    } finally {
      setLoading(false);
    }
  }, [activeQueue, page, queue, searchApplied]);

  useEffect(() => {
    void load();
  }, [load]);

  const summary = data?.summary;
  const items = data?.items ?? [];
  const totalPages = data?.pageInfo.totalPages ?? 0;
  const totalCount = data?.pageInfo.totalCount ?? 0;

  const queueTitle = useMemo(() => {
    if (queue === "disputes") return "Disputes / chargebacks";
    if (queue === "refundable") return "Refundable payments";
    if (queue === "partial") return "Partially refunded";
    if (queue === "refunded") return "Fully refunded";
    return "Refund ledger";
  }, [queue]);

  const isEmpty = !loading && !error && queue !== "disputes" && items.length === 0;
  const allSelected = items.length > 0 && items.every((item) => selectedIds.has(item.orderId));

  async function handleExport() {
    setBusy(true);
    try {
      const queued = await exportPaymentTransactions({
        status: queue === "refunded" ? "refunded" : queue === "refundable" ? "paid" : undefined,
        q: searchApplied || undefined,
        page: 1,
        limit: 100,
      });
      const completed = await pollReportRunUntilComplete(queued.data.runId);
      if (completed.status !== "completed") {
        throw new Error(completed.errorMessage ?? "Export failed.");
      }
      await downloadReportExport(queued.data.runId, "csv");
    } catch (err) {
      setError(
        err instanceof ClientApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Unable to export.",
      );
    } finally {
      setBusy(false);
    }
  }

  function queueCount(key: (typeof QUEUES)[number]["key"]): number | null {
    if (!summary) return null;
    if (key === "disputes") return 0;
    if (key === "all") {
      return summary.refundableCount + summary.partialCount + summary.refundedCount;
    }
    const entry = QUEUES.find((item) => item.key === key);
    if (!entry?.countKey) return null;
    return summary[entry.countKey] as number;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <nav className="flex items-center gap-2 font-mono text-xs text-[var(--admin-on-surface-variant)]">
          <Link href="/admin" className="hover:text-[var(--admin-primary)]">
            Admin
          </Link>
          <span>/</span>
          <Link href="/admin/reports/payments" className="hover:text-[var(--admin-primary)]">
            Payments
          </Link>
          <span>/</span>
          <span className="text-[var(--admin-on-surface)]">Refunds</span>
        </nav>
        <PaymentsReportTabs active="refunds" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--admin-on-surface)] md:text-3xl">
            Refunds
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-[var(--admin-on-surface-variant)]">
            Record and review ledger refunds against paid orders. This is not a support request
            queue.
          </p>
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
              className="w-fit font-mono text-xs font-bold uppercase underline"
              onClick={() => void load()}
            >
              Try again
            </button>
          </div>
        </div>
      ) : null}

      <div className="flex min-h-[560px] flex-col overflow-hidden border border-[var(--admin-border)] bg-[var(--admin-surface)] lg:flex-row">
        <aside className="flex w-full shrink-0 flex-col border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] lg:w-[220px] lg:border-b-0 lg:border-r">
          <div className="border-b border-[var(--admin-border)] p-4">
            <h2 className="font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--admin-on-surface-variant)]">
              Queues
            </h2>
          </div>
          <ul className="flex-1 overflow-y-auto py-2">
            {QUEUES.map((item) => {
              const active = queue === item.key;
              const count = queueCount(item.key);
              return (
                <li key={item.key}>
                  <button
                    type="button"
                    className={[
                      "flex w-full items-center justify-between border-l-4 px-4 py-2 text-left text-sm transition-colors",
                      active
                        ? "border-[var(--admin-primary)] bg-[var(--admin-surface-high)] font-semibold text-[var(--admin-primary)]"
                        : "border-transparent text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-variant)] hover:text-[var(--admin-on-surface)]",
                    ].join(" ")}
                    onClick={() => {
                      setQueue(item.key);
                      setPage(1);
                    }}
                  >
                    <span>{item.label}</span>
                    {count != null ? (
                      <span
                        className={[
                          "px-1.5 py-0.5 font-mono text-[10px]",
                          active
                            ? "bg-[var(--admin-primary)] text-[var(--admin-on-primary)]"
                            : "bg-[var(--admin-surface-variant)] text-[var(--admin-on-surface-variant)]",
                        ].join(" ")}
                      >
                        {count}
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="mt-auto border-t border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
            <p className="mb-1 font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--admin-on-surface-variant)]">
              Exposure
            </p>
            <p className="font-mono text-xs font-bold text-[var(--admin-warning)]">
              Refundable{" "}
              {formatMoney(
                summary?.refundableAmountCents ?? 0,
                summary?.currency ?? "USD",
              )}
            </p>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--admin-border)] bg-[color-mix(in_srgb,var(--admin-surface)_50%,transparent)] px-4 py-3">
            <h2 className="text-lg font-semibold text-[var(--admin-on-surface)]">
              {queueTitle}{" "}
              {queue !== "disputes" ? (
                <span className="ml-2 font-mono text-xs font-normal text-[var(--admin-on-surface-variant)]">
                  ({totalCount})
                </span>
              ) : null}
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search
                  className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-on-surface-variant)]"
                  aria-hidden="true"
                />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      setSearchApplied(search.trim());
                      setPage(1);
                    }
                  }}
                  placeholder="Learner / invoice / ID"
                  className="w-48 border-0 border-b border-[var(--admin-border)] bg-[var(--admin-surface)] py-1.5 pl-8 pr-2 font-mono text-xs text-[var(--admin-on-surface)] outline-none focus:border-[var(--admin-primary)]"
                  disabled={queue === "disputes"}
                />
              </div>
              <button
                type="button"
                className="inline-flex h-8 items-center gap-1 rounded border border-[var(--admin-border)] px-2 font-mono text-[10px] font-bold uppercase tracking-wide disabled:opacity-40"
                disabled={loading || queue === "disputes"}
                onClick={() => {
                  setSearchApplied(search.trim());
                  setPage(1);
                  void load();
                }}
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                Refresh
              </button>
              <button
                type="button"
                className="inline-flex h-8 items-center gap-1 rounded border border-[var(--admin-border)] px-2 font-mono text-[10px] font-bold uppercase tracking-wide disabled:opacity-40"
                disabled={busy || loading || queue === "disputes"}
                onClick={() => void handleExport()}
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                Export
              </button>
            </div>
          </div>

          {queue === "disputes" ? (
            <div className="flex flex-1 items-center justify-center p-8">
              <div className="max-w-md border border-dashed border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-8 text-center">
                <Undo2 className="mx-auto mb-4 h-10 w-10 text-[var(--admin-on-surface-variant)]" aria-hidden="true" />
                <h3 className="text-lg font-semibold text-[var(--admin-on-surface)]">
                  Disputes are not available yet
                </h3>
                <p className="mt-2 text-sm text-[var(--admin-on-surface-variant)]">
                  Chargeback and dispute workflows need provider event ingestion. Use the refundable
                  and refunded queues for LMS ledger refunds.
                </p>
              </div>
            </div>
          ) : null}

          {queue !== "disputes" && loading ? (
            <div className="space-y-2 p-4" aria-busy="true">
              {Array.from({ length: 6 }).map((_, index) => (
                <Shimmer key={index} className="h-14 w-full" />
              ))}
            </div>
          ) : null}

          {queue !== "disputes" && isEmpty ? (
            <div className="relative flex flex-1 items-center justify-center p-8">
              <div
                className="pointer-events-none absolute inset-0 opacity-[0.06]"
                style={{
                  backgroundImage:
                    "radial-gradient(circle at 1px 1px, var(--admin-border) 1px, transparent 0)",
                  backgroundSize: "16px 16px",
                }}
                aria-hidden="true"
              />
              <div className="relative z-10 max-w-md border border-[var(--admin-border)] bg-[var(--admin-surface-high)] p-8 text-center">
                <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface)] text-[var(--admin-on-surface-variant)]">
                  <Undo2 className="h-8 w-8" aria-hidden="true" />
                </div>
                <h3 className="text-xl font-bold text-[var(--admin-on-surface)]">
                  {queue === "refunded" ? "No completed refunds yet" : "Queue clear"}
                </h3>
                <p className="mt-2 text-sm text-[var(--admin-on-surface-variant)]">
                  {queue === "refundable"
                    ? "No paid orders currently have a remaining refundable balance."
                    : queue === "partial"
                      ? "No partially refunded orders in this view."
                      : "All processed ledger refunds will appear here for audit."}
                </p>
                {queue === "refundable" || queue === "all" ? (
                  <Link
                    href="/admin/reports/payments/transactions?status=paid"
                    className="mt-6 inline-flex rounded bg-[var(--admin-primary)] px-6 py-2 font-mono text-xs font-bold uppercase tracking-widest text-[var(--admin-on-primary)]"
                  >
                    Browse paid transactions
                  </Link>
                ) : null}
              </div>
            </div>
          ) : null}

          {queue !== "disputes" && !loading && !isEmpty ? (
            <>
              <div className="hidden items-center gap-4 border-b border-[var(--admin-border)] bg-[var(--admin-surface-variant)] px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)] md:flex">
                <div className="flex w-6 justify-center">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={(event) => {
                      if (event.target.checked) {
                        setSelectedIds(new Set(items.map((item) => item.orderId)));
                      } else {
                        setSelectedIds(new Set());
                      }
                    }}
                    className="h-4 w-4 accent-[var(--admin-primary)]"
                    aria-label="Select all"
                  />
                </div>
                <div className="w-32">Type & reason</div>
                <div className="w-48">Learner / product</div>
                <div className="w-32 text-right">Amount</div>
                <div className="flex-1">Context</div>
                <div className="w-[160px] text-right">Actions</div>
              </div>

              <div className="flex-1 overflow-y-auto">
                {items.map((item) => (
                  <RefundRow
                    key={item.orderId}
                    item={item}
                    selected={selectedIds.has(item.orderId)}
                    onSelect={(checked) => {
                      setSelectedIds((current) => {
                        const next = new Set(current);
                        if (checked) next.add(item.orderId);
                        else next.delete(item.orderId);
                        return next;
                      });
                    }}
                    onOpen={() => setDrawerOrderId(item.orderId)}
                    onIssue={() => {
                      void (async () => {
                        try {
                          const response = await fetchPaymentTransactionDetail(item.orderId);
                          setRefundDetail(response.data);
                        } catch (err) {
                          setError(
                            err instanceof ClientApiError
                              ? err.message
                              : err instanceof Error
                                ? err.message
                                : "Unable to open refund.",
                          );
                        }
                      })();
                    }}
                  />
                ))}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-3">
                <span className="font-mono text-xs text-[var(--admin-on-surface-variant)]">
                  {totalCount.toLocaleString()} rows
                  {selectedIds.size > 0 ? ` · ${selectedIds.size} selected` : ""}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={page <= 1 || loading}
                    className="inline-flex h-8 w-8 items-center justify-center rounded border border-[var(--admin-border)] disabled:opacity-40"
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <span className="font-mono text-xs">
                    {totalPages === 0 ? 0 : page} / {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={page >= totalPages || loading}
                    className="inline-flex h-8 w-8 items-center justify-center rounded border border-[var(--admin-border)] disabled:opacity-40"
                    onClick={() => setPage((current) => current + 1)}
                    aria-label="Next page"
                  >
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>

      {drawerOrderId ? (
        <RefundDetailDrawer
          orderId={drawerOrderId}
          onClose={() => setDrawerOrderId(null)}
          onIssueRefund={(detail) => {
            setDrawerOrderId(null);
            setRefundDetail(detail);
          }}
        />
      ) : null}

      {refundDetail ? (
        <AdminPaymentRefundModal
          open
          detail={refundDetail}
          onClose={() => setRefundDetail(null)}
          onRefunded={() => {
            setRefundDetail(null);
            setDrawerOrderId(null);
            void load();
          }}
        />
      ) : null}
    </div>
  );
}

function RefundRow({
  item,
  selected,
  onSelect,
  onOpen,
  onIssue,
}: {
  item: PaymentRefundLedgerItem;
  selected: boolean;
  onSelect: (checked: boolean) => void;
  onOpen: () => void;
  onIssue: () => void;
}) {
  const isFullyRefunded =
    item.refundableAmountCents === 0 && item.refundedAmountCents > 0;
  const isPartial = item.refundedAmountCents > 0 && item.refundableAmountCents > 0;

  return (
    <div
      className={[
        "group flex flex-col gap-3 border-b border-[var(--admin-border)] border-l-4 px-4 py-3 transition-colors hover:bg-[var(--admin-surface-variant)] md:flex-row md:items-center md:gap-4",
        isFullyRefunded
          ? "border-l-[var(--admin-success)] bg-[color-mix(in_srgb,var(--admin-success)_4%,transparent)]"
          : isPartial
            ? "border-l-[var(--admin-warning)]"
            : "border-l-transparent",
      ].join(" ")}
    >
      <div className="flex w-6 justify-center md:shrink-0">
        <input
          type="checkbox"
          checked={selected}
          onChange={(event) => onSelect(event.target.checked)}
          className="h-4 w-4 accent-[var(--admin-primary)]"
          aria-label={`Select ${item.learnerName ?? item.orderId}`}
        />
      </div>
      <div className="flex w-full flex-col items-start gap-1 md:w-32">
        <span className="border border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-2 py-0.5 font-mono text-[10px] text-[var(--admin-on-surface)]">
          {isFullyRefunded ? "Refunded" : isPartial ? "Partial" : "Refundable"}
        </span>
        {item.latestRefund ? (
          <span className="border border-[var(--admin-border)] px-1 py-0.5 font-mono text-[10px] text-[var(--admin-on-surface-variant)]">
            {reasonLabel(item.latestRefund.reason)}
          </span>
        ) : (
          <span className="font-mono text-[10px] text-[var(--admin-on-surface-variant)]">
            No refund yet
          </span>
        )}
      </div>
      <button
        type="button"
        className="flex w-full flex-col text-left md:w-48"
        onClick={onOpen}
      >
        <span className="truncate text-sm text-[var(--admin-on-surface)]">
          {item.learnerName ?? "—"}
        </span>
        <span className="truncate font-mono text-[10px] text-[var(--admin-on-surface-variant)]">
          {item.productTitle ?? "—"}
        </span>
      </button>
      <div className="w-full text-left font-mono text-xs text-[var(--admin-on-surface)] md:w-32 md:text-right">
        {formatMoney(
          isFullyRefunded || isPartial ? item.refundedAmountCents : item.refundableAmountCents,
          item.currency,
        )}
        <div className="mt-0.5 text-[10px] text-[var(--admin-on-surface-variant)]">
          {item.gatewayKey ?? "—"}
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
          {item.latestRefund
            ? `Refund ${formatRelative(item.latestRefund.createdAt)} · ${item.latestRefund.id.slice(0, 8)}`
            : `Paid ${formatRelative(item.paidAt ?? item.createdAt)}`}
        </span>
        <span className="mt-0.5 font-mono text-xs text-[var(--admin-primary)]">
          {isFullyRefunded
            ? "Fully refunded on ledger"
            : isPartial
              ? `${formatMoney(item.refundableAmountCents, item.currency)} still refundable`
              : "Eligible to record a refund"}
        </span>
      </div>
      <div className="flex w-full items-center justify-end gap-2 md:w-[160px] md:opacity-0 md:transition-opacity md:group-hover:opacity-100">
        {item.canRefund ? (
          <button
            type="button"
            className="border border-[var(--admin-primary)] bg-[var(--admin-primary)] px-3 py-1 font-mono text-[10px] font-bold uppercase text-[var(--admin-on-primary)]"
            onClick={onIssue}
          >
            Issue
          </button>
        ) : null}
        <button
          type="button"
          className="border border-[var(--admin-border)] px-3 py-1 font-mono text-[10px] font-bold uppercase text-[var(--admin-on-surface)] hover:border-[var(--admin-primary)]"
          onClick={onOpen}
        >
          Details
        </button>
      </div>
    </div>
  );
}
