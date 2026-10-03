"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Info,
  List,
  RefreshCw,
  Search,
  Settings2,
  TrendingUp,
  Webhook,
  X,
  Landmark,
  Wrench,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Select } from "@atlas/design-system";
import { ClientApiError } from "../../../lib/client-api";
import {
  dateInputToEndIso,
  dateInputToStartIso,
  exportGatewayTransactions,
  fetchGatewayTransactions,
  fetchPaymentGatewayDetail,
  setPaymentGatewayPublished,
  type PaymentGatewayDetail,
  type PaymentTransactionItem,
} from "./admin-payments-roster-api";
import { downloadReportExport, pollReportRunUntilComplete } from "./admin-reports-api";
import { PaymentsReportTabs } from "./PaymentsReportTabs";

type DetailTab = "transactions" | "payouts" | "webhooks" | "configuration";

const STATUS_OPTIONS = [
  { value: "", label: "Status: All" },
  { value: "paid", label: "Paid" },
  { value: "pending", label: "Pending" },
  { value: "failed", label: "Failed" },
  { value: "refunded", label: "Refunded" },
];

const PAGE_SIZE = 12;

function defaultDateRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to.getTime() - 29 * 24 * 60 * 60 * 1000);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

function formatMoney(cents: number, currency: string): string {
  return `${(cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    year: "2-digit",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function statusBadge(status: string): { label: string; className: string } {
  const normalized = status.toLowerCase();
  if (normalized === "paid" || normalized === "captured") {
    return {
      label: normalized === "captured" ? "Captured" : "Paid",
      className:
        "border-[color-mix(in_srgb,var(--admin-success)_30%,transparent)] bg-[color-mix(in_srgb,var(--admin-success)_12%,transparent)] text-[var(--admin-success)]",
    };
  }
  if (normalized === "failed" || normalized === "failure" || normalized === "declined") {
    return {
      label: "Failed",
      className:
        "border-[color-mix(in_srgb,var(--admin-danger)_30%,transparent)] bg-[color-mix(in_srgb,var(--admin-danger)_12%,transparent)] text-[var(--admin-danger)]",
    };
  }
  if (normalized === "refunded" || normalized === "refund") {
    return {
      label: "Refunded",
      className:
        "border-[color-mix(in_srgb,var(--admin-warning)_30%,transparent)] bg-[color-mix(in_srgb,var(--admin-warning)_12%,transparent)] text-[var(--admin-warning)]",
    };
  }
  return {
    label: status,
    className:
      "border-[var(--admin-border)] bg-[var(--admin-surface-variant)] text-[var(--admin-on-surface-variant)]",
  };
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

function DisableGatewayModal({
  displayName,
  busy,
  error,
  onClose,
  onConfirm,
}: {
  displayName: string;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const [confirmName, setConfirmName] = useState("");
  const matched = confirmName.trim().toLowerCase() === displayName.trim().toLowerCase();

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-[color-mix(in_srgb,var(--admin-bg)_90%,transparent)] p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="disable-gateway-title"
    >
      <div className="admin-theme flex w-full max-w-lg flex-col border border-[var(--admin-border)] bg-[var(--admin-surface-low)] shadow-2xl">
        <div className="flex items-center gap-4 border-b border-[var(--admin-border)] bg-[var(--admin-surface)] p-6">
          <AlertTriangle className="h-5 w-5 text-[var(--admin-danger)]" aria-hidden="true" />
          <h2
            id="disable-gateway-title"
            className="text-xl font-semibold text-[var(--admin-on-surface)]"
          >
            Disable {displayName}
          </h2>
          <button
            type="button"
            className="ml-auto text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="flex flex-col gap-6 p-6">
          <div className="flex gap-4 border-l-[3px] border-[var(--admin-warning)] bg-[var(--admin-surface-high)] p-4">
            <Info
              className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-warning)]"
              aria-hidden="true"
            />
            <p className="text-sm leading-relaxed text-[var(--admin-on-surface-variant)]">
              Disabling this gateway will stop new checkouts from routing through {displayName}.
              In-flight payments and pending refunds will continue to process.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-sm text-[var(--admin-on-surface)]">
              To confirm, type the name of the gateway below.
            </p>
            <label
              className="font-mono text-xs font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]"
              htmlFor="gateway-confirm"
            >
              Gateway name
            </label>
            <input
              id="gateway-confirm"
              autoComplete="off"
              value={confirmName}
              onChange={(event) => {
                setConfirmName(event.target.value);
              }}
              placeholder={displayName}
              className="w-full border-0 border-b border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-3 font-mono text-sm text-[var(--admin-on-surface)] outline-none focus:border-[var(--admin-danger)]"
            />
          </div>
          {error ? (
            <p role="alert" className="text-sm text-[var(--admin-danger)]">
              {error}
            </p>
          ) : null}
        </div>
        <div className="flex justify-end gap-3 border-t border-[var(--admin-border)] bg-[var(--admin-surface)] p-6">
          <button
            type="button"
            className="px-6 py-3 font-mono text-xs font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!matched || busy}
            className="inline-flex items-center gap-2 bg-[var(--admin-danger)] px-6 py-3 font-mono text-xs font-bold uppercase tracking-wider text-[var(--admin-on-danger)] disabled:opacity-40"
            onClick={onConfirm}
          >
            <Ban className="h-4 w-4" aria-hidden="true" />
            {busy ? "Disabling…" : `Disable ${displayName}`}
          </button>
        </div>
      </div>
    </div>
  );
}

export function AdminPaymentsGatewayDetailPage({ gatewayKey }: { gatewayKey: string }) {
  const router = useRouter();
  const defaults = useMemo(() => defaultDateRange(), []);
  const [paidFrom, setPaidFrom] = useState(defaults.from);
  const [paidTo, setPaidTo] = useState(defaults.to);
  const [tab, setTab] = useState<DetailTab>("transactions");
  const [detail, setDetail] = useState<PaymentGatewayDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(true);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [searchApplied, setSearchApplied] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<PaymentTransactionItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [pageAmountCents, setPageAmountCents] = useState(0);
  const [txCurrency, setTxCurrency] = useState("USD");
  const [txLoading, setTxLoading] = useState(false);
  const [txError, setTxError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [disableOpen, setDisableOpen] = useState(false);
  const [disableError, setDisableError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const loadDetail = useCallback(async () => {
    setDetailLoading(true);
    setDetailError(null);
    try {
      const response = await fetchPaymentGatewayDetail(gatewayKey, {
        ...(dateInputToStartIso(paidFrom) !== undefined
          ? { paidFrom: dateInputToStartIso(paidFrom) }
          : {}),
        ...(dateInputToEndIso(paidTo) !== undefined ? { paidTo: dateInputToEndIso(paidTo) } : {}),
      });
      setDetail(response.data);
    } catch (error) {
      setDetail(null);
      setDetailError(
        error instanceof ClientApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Unable to load gateway details.",
      );
    } finally {
      setDetailLoading(false);
    }
  }, [gatewayKey, paidFrom, paidTo]);

  const loadTransactions = useCallback(async () => {
    if (tab !== "transactions") return;
    setTxLoading(true);
    setTxError(null);
    try {
      const response = await fetchGatewayTransactions(gatewayKey, {
        paidFrom: dateInputToStartIso(paidFrom),
        paidTo: dateInputToEndIso(paidTo),
        learnerName: searchApplied || undefined,
        status: status || undefined,
        sortBy: "paid_at",
        sortDir: "desc",
        columns: [
          "learner_name",
          "email",
          "product_title",
          "amount_cents",
          "currency",
          "status",
          "paid_at",
        ],
        page,
        limit: PAGE_SIZE,
      });
      setItems(response.data.items);
      setTotalCount(response.data.pageInfo.totalCount);
      setTotalPages(response.data.pageInfo.totalPages);
      setPageAmountCents(response.data.totals.pageAmountCents);
      setTxCurrency(response.data.totals.currency);
      setSelectedIds(new Set());
    } catch (error) {
      setItems([]);
      setTxError(
        error instanceof ClientApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Unable to load gateway transactions.",
      );
    } finally {
      setTxLoading(false);
    }
  }, [gatewayKey, page, paidFrom, paidTo, searchApplied, status, tab]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  useEffect(() => {
    void loadTransactions();
  }, [loadTransactions]);

  async function handleExport() {
    if (!detail) return;
    setBusy(true);
    try {
      const queued = await exportGatewayTransactions(gatewayKey, {
        paidFrom: dateInputToStartIso(paidFrom),
        paidTo: dateInputToEndIso(paidTo),
        status: status || undefined,
      });
      const completed = await pollReportRunUntilComplete(queued.data.runId);
      if (completed.status !== "completed") {
        throw new Error(completed.errorMessage ?? "Export failed.");
      }
      await downloadReportExport(queued.data.runId, "csv");
    } catch (error) {
      setTxError(
        error instanceof ClientApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Unable to export transactions.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleDisable() {
    if (!detail) return;
    setBusy(true);
    setDisableError(null);
    try {
      await setPaymentGatewayPublished(detail.gateway.id, false);
      setDisableOpen(false);
      await loadDetail();
    } catch (error) {
      setDisableError(
        error instanceof ClientApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Unable to disable gateway.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleEnable() {
    if (!detail) return;
    setBusy(true);
    try {
      await setPaymentGatewayPublished(detail.gateway.id, true);
      await loadDetail();
    } catch (error) {
      setDetailError(
        error instanceof ClientApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Unable to publish gateway.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function copyKey() {
    if (!detail?.gateway.gatewayKey) return;
    try {
      await navigator.clipboard.writeText(detail.gateway.gatewayKey);
      setCopied(true);
      window.setTimeout(() => {
        setCopied(false);
      }, 1500);
    } catch {
      /* ignore */
    }
  }

  const allSelected = items.length > 0 && items.every((item) => selectedIds.has(item.id));
  const gateway = detail?.gateway;
  const summary = detail?.summary;

  const tabs: Array<{ key: DetailTab; label: string; icon: typeof List }> = [
    { key: "transactions", label: "Transactions", icon: List },
    { key: "payouts", label: "Payouts", icon: Landmark },
    { key: "webhooks", label: "Webhooks", icon: Webhook },
    { key: "configuration", label: "Configuration", icon: Wrench },
  ];

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
          <Link
            href="/admin/reports/payments/gateways"
            className="hover:text-[var(--admin-primary)]"
          >
            Gateways
          </Link>
        </nav>
        <PaymentsReportTabs active="gateways" />
      </div>

      <Link
        href="/admin/reports/payments/gateways"
        className="inline-flex w-fit items-center gap-1 font-mono text-xs text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-primary)]"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
        Back to Gateways
      </Link>

      {detailError && !detail ? (
        <div
          role="alert"
          className="flex items-start gap-3 rounded border border-[color-mix(in_srgb,var(--admin-danger)_35%,transparent)] bg-[color-mix(in_srgb,var(--admin-danger)_10%,transparent)] p-4 text-sm text-[var(--admin-danger)]"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <div className="flex flex-1 flex-col gap-2">
            <p>{detailError}</p>
            <button
              type="button"
              className="w-fit font-mono text-xs font-bold uppercase tracking-wide underline"
              onClick={() => void loadDetail()}
            >
              Try again
            </button>
          </div>
        </div>
      ) : null}

      {detailLoading && !detail ? (
        <div className="flex flex-col gap-4" aria-busy="true">
          <Shimmer className="h-16 w-full max-w-xl" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
            <Shimmer className="h-28 md:col-span-2" />
            <Shimmer className="h-28" />
            <Shimmer className="h-28" />
            <Shimmer className="h-28" />
          </div>
        </div>
      ) : null}

      {gateway && summary ? (
        <>
          <div className="flex flex-col justify-between gap-4 border-b border-[var(--admin-border)] pb-6 md:flex-row md:items-end">
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <div
                  className="flex h-12 w-12 items-center justify-center border border-[var(--admin-border)] bg-[var(--admin-surface-high)] text-lg font-semibold text-[var(--admin-on-surface)]"
                  aria-hidden="true"
                >
                  {gateway.displayName.trim().charAt(0).toUpperCase() || "G"}
                </div>
                <h1 className="text-2xl font-bold tracking-tight text-[var(--admin-on-surface)] md:text-3xl">
                  {gateway.displayName}
                </h1>
                <div className="flex flex-wrap items-center gap-2">
                  {gateway.isPublished ? (
                    <span className="inline-flex items-center gap-1 border border-[color-mix(in_srgb,var(--admin-success)_30%,transparent)] bg-[color-mix(in_srgb,var(--admin-success)_12%,transparent)] px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-wide text-[var(--admin-success)]">
                      <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                      Published
                    </span>
                  ) : gateway.isConfigured ? (
                    <span className="inline-flex items-center gap-1 border border-[color-mix(in_srgb,var(--admin-warning)_30%,transparent)] bg-[color-mix(in_srgb,var(--admin-warning)_12%,transparent)] px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-wide text-[var(--admin-warning)]">
                      Configured
                    </span>
                  ) : (
                    <span className="border border-[var(--admin-border)] bg-[var(--admin-surface-variant)] px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                      Draft
                    </span>
                  )}
                  {gateway.isDefault ? (
                    <span className="border border-[var(--admin-border)] bg-[var(--admin-surface)] px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                      Default gateway
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-4 font-mono text-xs">
                <button
                  type="button"
                  className="inline-flex items-center gap-2 text-[var(--admin-on-surface)] hover:text-[var(--admin-primary)]"
                  onClick={() => void copyKey()}
                >
                  <span className="text-[var(--admin-on-surface-variant)]">Key:</span>
                  <span>{gateway.gatewayKey}</span>
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-[var(--admin-success)]" aria-hidden="true" />
                  ) : (
                    <Copy
                      className="h-3.5 w-3.5 text-[var(--admin-on-surface-variant)]"
                      aria-hidden="true"
                    />
                  )}
                </button>
                <span className="text-[var(--admin-border)]">|</span>
                <span className="text-[var(--admin-on-surface-variant)]">
                  Added {formatDate(gateway.createdAt)}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <label className="inline-flex h-9 items-center gap-2 rounded border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 font-mono text-xs text-[var(--admin-on-surface)]">
                <CalendarDays
                  className="h-4 w-4 text-[var(--admin-on-surface-variant)]"
                  aria-hidden="true"
                />
                <span className="sr-only">From</span>
                <input
                  type="date"
                  value={paidFrom}
                  onChange={(event) => {
                    setPaidFrom(event.target.value);
                    setPage(1);
                  }}
                  className="bg-transparent outline-none"
                />
                <span className="text-[var(--admin-on-surface-variant)]">–</span>
                <span className="sr-only">To</span>
                <input
                  type="date"
                  value={paidTo}
                  onChange={(event) => {
                    setPaidTo(event.target.value);
                    setPage(1);
                  }}
                  className="bg-transparent outline-none"
                />
              </label>
              <Link
                href={`/admin/learner-billing/payment-gateway/${gateway.id}/configure`}
                className="inline-flex h-9 items-center gap-2 rounded border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 font-mono text-xs font-bold uppercase tracking-wide text-[var(--admin-on-surface)] hover:border-[var(--admin-primary)]"
              >
                <Settings2 className="h-4 w-4" aria-hidden="true" />
                Settings
              </Link>
              <button
                type="button"
                disabled={busy || txLoading}
                className="inline-flex h-9 items-center gap-2 rounded border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 font-mono text-xs font-bold uppercase tracking-wide text-[var(--admin-on-surface)] hover:border-[var(--admin-primary)] disabled:opacity-50"
                onClick={() => void handleExport()}
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                Export CSV
              </button>
              {gateway.isPublished ? (
                <button
                  type="button"
                  className="inline-flex h-9 items-center gap-2 rounded border border-[var(--admin-danger)] bg-transparent px-3 font-mono text-xs font-bold uppercase tracking-wide text-[var(--admin-danger)] hover:bg-[color-mix(in_srgb,var(--admin-danger)_10%,transparent)]"
                  onClick={() => {
                    setDisableError(null);
                    setDisableOpen(true);
                  }}
                >
                  <Ban className="h-4 w-4" aria-hidden="true" />
                  Disable
                </button>
              ) : (
                <button
                  type="button"
                  disabled={busy || !gateway.isConfigured}
                  className="inline-flex h-9 items-center gap-2 rounded bg-[var(--admin-primary)] px-3 font-mono text-xs font-bold uppercase tracking-wide text-[var(--admin-on-primary)] disabled:opacity-50"
                  onClick={() => void handleEnable()}
                >
                  Publish
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
            <div className="flex flex-col justify-between border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4 md:col-span-2">
              <div className="mb-4 flex items-start justify-between gap-2">
                <span className="font-mono text-xs font-bold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                  Total collected
                </span>
                {summary.changePercent != null ? (
                  <span className="inline-flex items-center gap-1 border border-[color-mix(in_srgb,var(--admin-success)_20%,transparent)] bg-[color-mix(in_srgb,var(--admin-success)_10%,transparent)] px-2 py-0.5 font-mono text-[10px] text-[var(--admin-success)]">
                    <TrendingUp className="h-3 w-3" aria-hidden="true" />
                    {summary.changePercent > 0 ? "+" : ""}
                    {summary.changePercent}%
                  </span>
                ) : null}
              </div>
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-2xl font-bold tracking-tight text-[var(--admin-on-surface)] md:text-3xl">
                  {(summary.paidAmountCents / 100).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
                <span className="font-mono text-xs text-[var(--admin-on-surface-variant)]">
                  {summary.currency}
                </span>
              </div>
              <p className="mt-2 font-mono text-[10px] text-[var(--admin-on-surface-variant)]">
                {summary.windowLabel}
              </p>
            </div>
            <div className="flex flex-col justify-between border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4">
              <span className="mb-4 font-mono text-xs font-bold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                Transactions
              </span>
              <span className="font-mono text-xl font-semibold text-[var(--admin-on-surface)]">
                {summary.paidTransactionCount.toLocaleString()}
              </span>
              <span className="mt-1 font-mono text-[10px] text-[var(--admin-on-surface-variant)]">
                {summary.transactionCount.toLocaleString()} attempts
              </span>
            </div>
            <div className="flex flex-col justify-between border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4">
              <span className="mb-4 font-mono text-xs font-bold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                Success rate
              </span>
              <span className="font-mono text-xl font-semibold text-[var(--admin-success)]">
                {summary.successPercent == null ? "—" : `${summary.successPercent.toFixed(1)}%`}
              </span>
              <span className="mt-1 font-mono text-[10px] text-[var(--admin-danger)]">
                {summary.failedCount} failed
              </span>
            </div>
            <div className="flex flex-col justify-between border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4">
              <span className="mb-4 font-mono text-xs font-bold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                Fees & refunds
              </span>
              <span className="font-mono text-sm text-[var(--admin-on-surface-variant)]">
                Fees not tracked
              </span>
              <div className="mt-1 flex justify-between border-t border-[var(--admin-border)] pt-1 font-mono text-[10px]">
                <span className="text-[var(--admin-on-surface-variant)]">Refunded</span>
                <span className="text-[var(--admin-warning)]">{summary.refundedCount}</span>
              </div>
            </div>
          </div>

          <div className="mt-2 flex gap-6 overflow-x-auto border-b border-[var(--admin-border)]">
            {tabs.map((item) => {
              const Icon = item.icon;
              const active = tab === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  className={[
                    "inline-flex items-center gap-2 whitespace-nowrap px-1 pb-2 font-mono text-xs transition-colors",
                    active
                      ? "border-b-2 border-[var(--admin-primary)] text-[var(--admin-primary)]"
                      : "border-b-2 border-transparent text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]",
                  ].join(" ")}
                  onClick={() => {
                    setTab(item.key);
                  }}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {item.label}
                </button>
              );
            })}
          </div>

          {tab === "transactions" ? (
            <div className="flex flex-col border border-[var(--admin-border)] bg-[var(--admin-surface)]">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--admin-border)] bg-[var(--admin-surface-high)] p-3">
                <div className="flex flex-1 flex-wrap items-center gap-3">
                  <div className="relative max-w-xs flex-1">
                    <Search
                      className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-on-surface-variant)]"
                      aria-hidden="true"
                    />
                    <input
                      value={search}
                      onChange={(event) => {
                        setSearch(event.target.value);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          setSearchApplied(search.trim());
                          setPage(1);
                        }
                      }}
                      placeholder="Search learner…"
                      className="w-full border-0 border-b border-[var(--admin-border)] bg-[var(--admin-surface)] py-1.5 pl-8 pr-3 font-mono text-xs text-[var(--admin-on-surface)] outline-none focus:border-[var(--admin-primary)]"
                    />
                  </div>
                  <div className="min-w-[160px]">
                    <Select
                      value={status}
                      onValueChange={(value) => {
                        setStatus(value);
                        setPage(1);
                      }}
                      options={STATUS_OPTIONS}
                      aria-label="Status filter"
                    />
                  </div>
                  <button
                    type="button"
                    className="inline-flex h-8 items-center gap-1 rounded border border-[var(--admin-border)] px-2 font-mono text-xs text-[var(--admin-on-surface)] hover:border-[var(--admin-primary)]"
                    onClick={() => {
                      setSearchApplied(search.trim());
                      setPage(1);
                      void loadTransactions();
                    }}
                  >
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                    Apply
                  </button>
                </div>
              </div>

              {selectedIds.size > 0 ? (
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[color-mix(in_srgb,var(--admin-primary)_30%,transparent)] bg-[color-mix(in_srgb,var(--admin-primary)_10%,transparent)] px-4 py-2">
                  <span className="inline-flex items-center gap-2 font-mono text-xs text-[var(--admin-primary)]">
                    <Check className="h-4 w-4" aria-hidden="true" />
                    {selectedIds.size} transaction{selectedIds.size === 1 ? "" : "s"} selected
                  </span>
                  <button
                    type="button"
                    className="border border-[var(--admin-border)] px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-wide text-[var(--admin-on-surface)] hover:border-[var(--admin-primary)]"
                    onClick={() => {
                      const ids = Array.from(selectedIds);
                      router.push(
                        `/admin/reports/payments/transactions/${String(ids[0])}${
                          ids.length > 1 ? `?selected=${ids.join(",")}` : ""
                        }`,
                      );
                    }}
                  >
                    Open first selected
                  </button>
                </div>
              ) : null}

              {txError ? (
                <p role="alert" className="p-4 text-sm text-[var(--admin-danger)]">
                  {txError}
                </p>
              ) : null}

              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)]">
                      <th className="w-12 px-4 py-3">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          onChange={(event) => {
                            if (event.target.checked) {
                              setSelectedIds(new Set(items.map((item) => item.id)));
                            } else {
                              setSelectedIds(new Set());
                            }
                          }}
                          className="h-4 w-4 accent-[var(--admin-primary)]"
                          aria-label="Select all on page"
                        />
                      </th>
                      <th className="px-4 py-3 font-mono text-xs font-bold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                        Date / Time
                      </th>
                      <th className="px-4 py-3 font-mono text-xs font-bold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                        Learner
                      </th>
                      <th className="px-4 py-3 font-mono text-xs font-bold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                        Product
                      </th>
                      <th className="px-4 py-3 text-right font-mono text-xs font-bold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                        Amount
                      </th>
                      <th className="px-4 py-3 font-mono text-xs font-bold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--admin-border)] font-mono text-xs">
                    {txLoading ? (
                      <tr>
                        <td colSpan={6} className="p-6">
                          <div className="space-y-2">
                            {Array.from({ length: 4 }).map((_, index) => (
                              <Shimmer key={index} className="h-8 w-full" />
                            ))}
                          </div>
                        </td>
                      </tr>
                    ) : items.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-4 py-8 text-center text-[var(--admin-on-surface-variant)]"
                        >
                          No transactions for this gateway in the selected range.
                        </td>
                      </tr>
                    ) : (
                      items.map((item) => {
                        const badge = statusBadge(item.status);
                        const selected = selectedIds.has(item.id);
                        return (
                          <tr
                            key={item.id}
                            className={[
                              "transition-colors hover:bg-[var(--admin-surface-high)]",
                              selected
                                ? "bg-[color-mix(in_srgb,var(--admin-primary)_6%,transparent)]"
                                : "",
                            ].join(" ")}
                          >
                            <td className="px-4 py-3">
                              <input
                                type="checkbox"
                                checked={selected}
                                onChange={(event) => {
                                  setSelectedIds((current) => {
                                    const next = new Set(current);
                                    if (event.target.checked) next.add(item.id);
                                    else next.delete(item.id);
                                    return next;
                                  });
                                }}
                                className="h-4 w-4 accent-[var(--admin-primary)]"
                                aria-label={`Select transaction ${item.externalId ?? item.id}`}
                              />
                            </td>
                            <td className="px-4 py-3 text-[var(--admin-on-surface-variant)]">
                              <Link
                                href={`/admin/reports/payments/transactions/${item.id}`}
                                className="hover:text-[var(--admin-primary)]"
                              >
                                {formatDateTime(item.paidAt ?? item.createdAt)}
                              </Link>
                              <br />
                              <span className="text-[10px] text-[var(--admin-primary)]">
                                {(item.externalId ?? item.id).slice(0, 12)}…
                              </span>
                            </td>
                            <td className="px-4 py-3 text-[var(--admin-on-surface)]">
                              {item.learnerName ?? "—"}
                              <br />
                              <span className="text-[10px] text-[var(--admin-on-surface-variant)]">
                                {item.email ?? "—"}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-[var(--admin-on-surface)]">
                              {item.productTitle ?? "—"}
                            </td>
                            <td className="px-4 py-3 text-right text-[var(--admin-on-surface)]">
                              {formatMoney(item.amountCents, item.currency)}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`inline-block border px-2 py-0.5 text-[10px] font-bold uppercase ${badge.className}`}
                              >
                                {badge.label}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                  <tfoot className="border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] font-mono text-xs">
                    <tr>
                      <td
                        className="px-4 py-3 text-right font-bold uppercase tracking-wide text-[var(--admin-on-surface-variant)]"
                        colSpan={4}
                      >
                        Page totals ({txCurrency})
                      </td>
                      <td className="px-4 py-3 text-right text-[var(--admin-on-surface)]">
                        {formatMoney(pageAmountCents, txCurrency)}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-3">
                <span className="font-mono text-xs text-[var(--admin-on-surface-variant)]">
                  {totalCount.toLocaleString()} transactions
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={page <= 1 || txLoading}
                    className="inline-flex h-8 w-8 items-center justify-center rounded border border-[var(--admin-border)] disabled:opacity-40"
                    onClick={() => {
                      setPage((current) => Math.max(1, current - 1));
                    }}
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <span className="font-mono text-xs text-[var(--admin-on-surface)]">
                    {totalPages === 0 ? 0 : page} / {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={page >= totalPages || txLoading}
                    className="inline-flex h-8 w-8 items-center justify-center rounded border border-[var(--admin-border)] disabled:opacity-40"
                    onClick={() => {
                      setPage((current) => current + 1);
                    }}
                    aria-label="Next page"
                  >
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {tab === "payouts" ? (
            <div className="rounded border border-dashed border-[var(--admin-border)] bg-[var(--admin-surface)] p-8">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-[var(--admin-border)] bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]">
                  <Landmark className="h-4 w-4" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[var(--admin-on-surface)]">
                    Payout reconciliation is not available yet
                  </p>
                  <p className="mt-1 max-w-2xl text-sm text-[var(--admin-on-surface-variant)]">
                    Settlement rows (gross, fees, net, UTR) will appear here once provider payout
                    feeds are connected. Collected volume above already reflects paid ledger
                    activity for this gateway.
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          {tab === "webhooks" ? (
            <div className="rounded border border-dashed border-[var(--admin-border)] bg-[var(--admin-surface)] p-8">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-[var(--admin-border)] bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]">
                  <Webhook className="h-4 w-4" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[var(--admin-on-surface)]">
                    Webhook delivery log is not available yet
                  </p>
                  <p className="mt-1 max-w-2xl text-sm text-[var(--admin-on-surface-variant)]">
                    Provider events currently update matching payment orders in place. A per-gateway
                    delivery inbox (retries, signatures, payloads) will land here when event storage
                    is added.
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          {tab === "configuration" ? (
            <div className="flex flex-col border border-[var(--admin-border)] bg-[var(--admin-surface)]">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4">
                <h2 className="text-lg font-semibold text-[var(--admin-on-surface)]">
                  Connection settings
                </h2>
                <Link
                  href={`/admin/learner-billing/payment-gateway/${gateway.id}/configure`}
                  className="inline-flex items-center gap-2 rounded border border-[var(--admin-primary)] bg-[var(--admin-surface)] px-4 py-2 font-mono text-xs font-bold uppercase tracking-wide text-[var(--admin-primary)] hover:bg-[color-mix(in_srgb,var(--admin-primary)_10%,transparent)]"
                >
                  <Settings2 className="h-4 w-4" aria-hidden="true" />
                  Edit in settings
                </Link>
              </div>
              <div className="grid grid-cols-1 gap-x-12 gap-y-6 p-6 md:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <span className="font-mono text-xs text-[var(--admin-on-surface-variant)]">
                    Status
                  </span>
                  <span className="mt-1 inline-flex w-fit items-center gap-1 border border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-wide text-[var(--admin-on-surface)]">
                    {gateway.isPublished
                      ? "Published"
                      : gateway.isConfigured
                        ? "Configured"
                        : "Draft"}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="font-mono text-xs text-[var(--admin-on-surface-variant)]">
                    Default gateway
                  </span>
                  <span className="mt-1 text-sm text-[var(--admin-on-surface)]">
                    {gateway.isDefault ? "Yes" : "No"}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="font-mono text-xs text-[var(--admin-on-surface-variant)]">
                    API key (public)
                  </span>
                  <div className="mt-1 flex items-center justify-between border border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-3 py-2 font-mono text-sm text-[var(--admin-on-surface)]">
                    <span>{gateway.publishableKeyMasked ?? "Not set"}</span>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="font-mono text-xs text-[var(--admin-on-surface-variant)]">
                    Secret key
                  </span>
                  <span className="mt-1 font-mono text-sm text-[var(--admin-on-surface)]">
                    {gateway.hasSecret ? `••••••••${gateway.secretLast4 ?? ""}` : "Not set"}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="font-mono text-xs text-[var(--admin-on-surface-variant)]">
                    Last updated
                  </span>
                  <span className="mt-1 text-sm text-[var(--admin-on-surface)]">
                    {formatDateTime(gateway.updatedAt)}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="font-mono text-xs text-[var(--admin-on-surface-variant)]">
                    Gateway key
                  </span>
                  <span className="mt-1 font-mono text-sm text-[var(--admin-on-surface)]">
                    {gateway.gatewayKey}
                  </span>
                </div>
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      {disableOpen && gateway ? (
        <DisableGatewayModal
          displayName={gateway.displayName}
          busy={busy}
          error={disableError}
          onClose={() => {
            setDisableOpen(false);
          }}
          onConfirm={() => void handleDisable()}
        />
      ) : null}
    </div>
  );
}
