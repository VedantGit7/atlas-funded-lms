"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowDown,
  Check,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Copy,
  Download,
  MoreVertical,
  Plus,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Select } from "@atlas/design-system";
import { ClientApiError } from "../../../lib/client-api";
import {
  dateInputToEndIso,
  dateInputToStartIso,
  downloadPaymentInvoice,
  exportPaymentTransactions,
  fetchPaymentGateways,
  fetchPaymentTransactions,
  PAYMENT_TRANSACTION_COLUMN_OPTIONS,
  type PaymentGatewayItem,
  type PaymentTransactionColumnKey,
  type PaymentTransactionItem,
} from "./admin-payments-roster-api";
import { downloadReportExport, pollReportRunUntilComplete } from "./admin-reports-api";
import { AdminPaymentTransactionDrawer } from "./AdminPaymentTransactionDrawer";
import { PaymentsReportTabs } from "./PaymentsReportTabs";

type SavedView = "all" | "failed_today" | "refund_candidates" | "high_value";
type DateField = "paid_at" | "created_at";

const PAGE_SIZE_OPTIONS = [
  { value: "12", label: "12" },
  { value: "24", label: "24" },
  { value: "48", label: "48" },
];

const STATUS_OPTIONS = [
  { value: "", label: "Status: All" },
  { value: "paid", label: "Paid" },
  { value: "pending", label: "Pending" },
  { value: "failed", label: "Failed" },
  { value: "refunded", label: "Refunded" },
];

const DATE_FIELD_OPTIONS = [
  { value: "paid_at", label: "Transaction date" },
  { value: "created_at", label: "Creation date" },
];

const DEFAULT_COLUMNS: PaymentTransactionColumnKey[] = [
  "learner_name",
  "email",
  "product_title",
  "product_type",
  "gateway_key",
  "coupon_amount_cents",
  "amount_cents",
  "currency",
  "status",
  "invoice_number",
  "paid_at",
];

const HIGH_VALUE_CENTS = 50_000;

function formatMoney(cents: number, currency: string): string {
  return `${(cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`;
}

function formatAmount(cents: number): string {
  return (cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatRelative(iso: string | null): string {
  if (!iso) return "-";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "-";
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${String(mins)} min${mins === 1 ? "" : "s"} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${String(hours)} hr${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${String(days)} days ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatAbsolute(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusBadge(status: string): { className: string; label: string } {
  const normalized = status.toLowerCase();
  if (normalized === "paid" || normalized === "succeeded" || normalized === "success") {
    return {
      label: "PAID",
      className:
        "bg-[color-mix(in_srgb,var(--admin-success)_12%,transparent)] text-[var(--admin-success)] border-[color-mix(in_srgb,var(--admin-success)_30%,transparent)]",
    };
  }
  if (normalized === "failed" || normalized === "failure" || normalized === "declined") {
    return {
      label: "FAILED",
      className:
        "bg-[color-mix(in_srgb,var(--admin-danger)_12%,transparent)] text-[var(--admin-danger)] border-[color-mix(in_srgb,var(--admin-danger)_30%,transparent)]",
    };
  }
  if (normalized === "refunded" || normalized === "partially_refunded") {
    return {
      label: "REFUNDED",
      className:
        "bg-[color-mix(in_srgb,var(--admin-warning)_12%,transparent)] text-[var(--admin-warning)] border-[color-mix(in_srgb,var(--admin-warning)_30%,transparent)]",
    };
  }
  return {
    label: status.toUpperCase() || "PENDING",
    className:
      "bg-[var(--admin-surface-variant)] text-[var(--admin-on-surface-variant)] border-[var(--admin-border)]",
  };
}

function gatewayTone(key: string | null): string {
  const normalized = (key ?? "").toLowerCase();
  if (normalized.includes("stripe")) {
    return "bg-[color-mix(in_srgb,#635BFF_20%,transparent)] text-[#635BFF]";
  }
  if (normalized.includes("paypal")) {
    return "bg-[color-mix(in_srgb,#0079C1_20%,transparent)] text-[#0079C1]";
  }
  return "bg-[var(--admin-surface-variant)] text-[var(--admin-on-surface)]";
}

function truncateId(value: string | null): string {
  if (!value) return "-";
  return value.length > 10 ? `${value.slice(0, 6)}…` : value;
}

function todayRange(): { from: string; to: string } {
  const now = new Date();
  const iso = now.toISOString().slice(0, 10);
  return { from: iso, to: iso };
}

function defaultRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to.getTime() - 34 * 24 * 60 * 60 * 1000);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

function Shimmer({ className }: { className?: string }) {
  return (
    <div
      className={[
        "relative overflow-hidden rounded-sm bg-[var(--admin-surface-high)]",
        "after:absolute after:inset-0 after:-translate-x-full after:animate-[shimmer_1.8s_infinite]",
        "after:bg-gradient-to-r after:from-transparent after:via-[color-mix(in_srgb,var(--admin-on-surface)_8%,transparent)] after:to-transparent",
        className ?? "",
      ].join(" ")}
    />
  );
}

function downloadHtmlFile(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function AdminPaymentsTransactionsLedgerPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const defaults = useMemo(() => defaultRange(), []);
  const [paidFrom, setPaidFrom] = useState(defaults.from);
  const [paidTo, setPaidTo] = useState(defaults.to);
  const [dateField, setDateField] = useState<DateField>("paid_at");
  const [search, setSearch] = useState("");
  const [searchApplied, setSearchApplied] = useState("");
  const [status, setStatus] = useState("");
  const [gatewayKey, setGatewayKey] = useState(() => searchParams.get("gateway")?.trim() ?? "");
  const [amountMinCents, setAmountMinCents] = useState<number | undefined>();
  const [view, setView] = useState<SavedView>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [sortBy, setSortBy] = useState("paid_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [columns, setColumns] = useState<PaymentTransactionColumnKey[]>(DEFAULT_COLUMNS);
  const [draftColumns, setDraftColumns] = useState<PaymentTransactionColumnKey[]>(DEFAULT_COLUMNS);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [gateways, setGateways] = useState<PaymentGatewayItem[]>([]);
  const [items, setItems] = useState<PaymentTransactionItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totals, setTotals] = useState({
    pageAmountCents: 0,
    filteredAmountCents: 0,
    currency: "USD",
  });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [rowMenuId, setRowMenuId] = useState<string | null>(null);
  const [drawerOrderId, setDrawerOrderId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const columnsRef = useRef<HTMLDivElement>(null);

  const gatewayOptions = useMemo(
    () => [
      { value: "", label: "Gateway: All" },
      ...gateways.map((gateway) => ({
        value: gateway.gatewayKey,
        label: gateway.displayName,
      })),
    ],
    [gateways],
  );

  const activeFilterChips = useMemo(() => {
    const chips: Array<{ key: string; label: string; clear: () => void }> = [];
    if (searchApplied) {
      chips.push({
        key: "search",
        label: `Search: ${searchApplied}`,
        clear: () => {
          setSearch("");
          setSearchApplied("");
          setPage(1);
        },
      });
    }
    if (status) {
      chips.push({
        key: "status",
        label: `Status: ${status}`,
        clear: () => {
          setStatus("");
          setPage(1);
        },
      });
    }
    if (gatewayKey) {
      const label =
        gateways.find((gateway) => gateway.gatewayKey === gatewayKey)?.displayName ?? gatewayKey;
      chips.push({
        key: "gateway",
        label: `Gateway: ${label}`,
        clear: () => {
          setGatewayKey("");
          setPage(1);
        },
      });
    }
    if (amountMinCents != null) {
      chips.push({
        key: "amount",
        label: `Min amount: ${formatAmount(amountMinCents)}`,
        clear: () => {
          setAmountMinCents(undefined);
          setPage(1);
        },
      });
    }
    return chips;
  }, [amountMinCents, gatewayKey, gateways, searchApplied, status]);

  const loadGateways = useCallback(async () => {
    try {
      const response = await fetchPaymentGateways();
      setGateways(response.data.items);
    } catch {
      setGateways([]);
    }
  }, []);

  const loadTransactions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchPaymentTransactions({
        paidFrom: dateInputToStartIso(paidFrom),
        paidTo: dateInputToEndIso(paidTo),
        learnerName: searchApplied || undefined,
        gatewayKey: gatewayKey || undefined,
        status: status || undefined,
        amountMinCents,
        dateField,
        sortBy,
        sortDir,
        columns,
        page,
        limit: pageSize,
      });
      setItems(response.data.items);
      setTotalCount(response.data.pageInfo.totalCount);
      setTotalPages(response.data.pageInfo.totalPages);
      setTotals(response.data.totals);
      setSelectedIds(new Set());
    } catch (loadError) {
      setItems([]);
      setTotalCount(0);
      setTotalPages(0);
      setError(
        loadError instanceof ClientApiError
          ? loadError.message
          : loadError instanceof Error
            ? loadError.message
            : "Couldn't load transaction data.",
      );
    } finally {
      setLoading(false);
    }
  }, [
    amountMinCents,
    columns,
    dateField,
    gatewayKey,
    page,
    pageSize,
    paidFrom,
    paidTo,
    searchApplied,
    sortBy,
    sortDir,
    status,
  ]);

  useEffect(() => {
    void loadGateways();
  }, [loadGateways]);

  useEffect(() => {
    void loadTransactions();
  }, [loadTransactions]);

  useEffect(() => {
    function onDocClick(event: MouseEvent) {
      if (!columnsRef.current?.contains(event.target as Node)) {
        setColumnsOpen(false);
      }
      setRowMenuId(null);
    }
    document.addEventListener("click", onDocClick);
    return () => {
      document.removeEventListener("click", onDocClick);
    };
  }, []);

  function applyView(next: SavedView) {
    setView(next);
    setPage(1);
    if (next === "all") {
      setStatus("");
      setAmountMinCents(undefined);
      setPaidFrom(defaults.from);
      setPaidTo(defaults.to);
      return;
    }
    if (next === "failed_today") {
      const range = todayRange();
      setPaidFrom(range.from);
      setPaidTo(range.to);
      setStatus("failed");
      setAmountMinCents(undefined);
      return;
    }
    if (next === "refund_candidates") {
      setStatus("paid");
      setAmountMinCents(undefined);
      return;
    }
    setStatus("paid");
    setAmountMinCents(HIGH_VALUE_CENTS);
  }

  function clearAllFilters() {
    setView("all");
    setSearch("");
    setSearchApplied("");
    setStatus("");
    setGatewayKey("");
    setAmountMinCents(undefined);
    setPaidFrom(defaults.from);
    setPaidTo(defaults.to);
    setDateField("paid_at");
    setPage(1);
  }

  async function handleExport(selectedOnly = false) {
    setBusy(true);
    setError(null);
    try {
      const response = await exportPaymentTransactions({
        paidFrom: dateInputToStartIso(paidFrom),
        paidTo: dateInputToEndIso(paidTo),
        learnerName: searchApplied || undefined,
        gatewayKey: gatewayKey || undefined,
        status: status || undefined,
        sortBy,
        sortDir,
        columns,
        emailDownloadLink: true,
        ...(selectedOnly && selectedIds.size > 0
          ? {
              /* selection exported via filtered list when possible */
            }
          : {}),
      });
      const completed = await pollReportRunUntilComplete(response.data.runId);
      if (completed.status !== "completed") {
        throw new Error(completed.errorMessage ?? "Export failed.");
      }
      await downloadReportExport(completed.id, "csv");
    } catch (exportError) {
      setError(
        exportError instanceof ClientApiError
          ? exportError.message
          : exportError instanceof Error
            ? exportError.message
            : "Unable to export transactions.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleDownloadInvoice(orderId: string) {
    setBusy(true);
    setError(null);
    try {
      const response = await downloadPaymentInvoice(orderId);
      downloadHtmlFile(response.data.filename, response.data.content);
    } catch (downloadError) {
      setError(
        downloadError instanceof ClientApiError
          ? downloadError.message
          : downloadError instanceof Error
            ? downloadError.message
            : "Unable to download invoice.",
      );
    } finally {
      setBusy(false);
      setRowMenuId(null);
    }
  }

  function toggleSelectAll() {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(items.map((item) => item.id)));
  }

  function toggleSelect(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function copyExternalId(value: string | null) {
    if (!value) return;
    await navigator.clipboard.writeText(value);
  }

  const selectedTotal = items
    .filter((item) => selectedIds.has(item.id))
    .reduce((sum, item) => sum + item.amountCents, 0);
  const rangeStart = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, totalCount);
  const showEmpty = !loading && !error && items.length === 0;
  const hasFilters = activeFilterChips.length > 0 || view !== "all";

  const showCol = (key: PaymentTransactionColumnKey) => columns.includes(key);

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6">
      <PaymentsReportTabs active="transactions" />

      <div className="flex flex-col gap-4 border-b border-[var(--admin-border)] pb-4">
        <nav className="flex items-center gap-2 font-mono text-xs text-[var(--admin-on-surface-variant)]">
          <Link href="/admin" className="hover:text-[var(--admin-primary)]">
            Admin
          </Link>
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          <Link href="/admin/reports/enrollments" className="hover:text-[var(--admin-primary)]">
            Reports
          </Link>
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          <Link href="/admin/reports/payments" className="hover:text-[var(--admin-primary)]">
            Payments
          </Link>
        </nav>

        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--admin-on-surface)] md:text-3xl">
              Transactions
            </h1>
            <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
              Every payment attempt recorded against a learner order.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex h-9 items-center gap-2 rounded border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 font-mono text-xs">
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

            <div className="relative" ref={columnsRef}>
              <button
                type="button"
                className={[
                  "inline-flex h-9 items-center gap-2 rounded border px-3 font-mono text-xs font-bold uppercase tracking-wide transition-colors",
                  columnsOpen
                    ? "border-[var(--admin-primary)] bg-[var(--admin-surface-high)] text-[var(--admin-primary)]"
                    : "border-[var(--admin-border)] bg-[var(--admin-surface)] text-[var(--admin-on-surface)] hover:border-[var(--admin-primary)]",
                ].join(" ")}
                onClick={(event) => {
                  event.stopPropagation();
                  setDraftColumns(columns);
                  setColumnsOpen((open) => !open);
                }}
              >
                <Columns3 className="h-4 w-4" aria-hidden="true" />
                Columns ({columns.length}/{PAYMENT_TRANSACTION_COLUMN_OPTIONS.length})
              </button>

              {columnsOpen ? (
                <div
                  className="absolute right-0 top-[calc(100%+8px)] z-40 flex w-[min(480px,calc(100vw-2rem))] flex-col border border-[var(--admin-border)] bg-[var(--admin-surface-high)] shadow-2xl"
                  onClick={(event) => {
                    event.stopPropagation();
                  }}
                >
                  <div className="flex items-center justify-between border-b border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
                    <h3 className="text-base font-semibold text-[var(--admin-on-surface)]">
                      Manage columns
                    </h3>
                    <button
                      type="button"
                      className="text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]"
                      onClick={() => {
                        setColumnsOpen(false);
                      }}
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                  <div className="grid max-h-[360px] grid-cols-1 gap-1 overflow-y-auto p-4 sm:grid-cols-2">
                    {PAYMENT_TRANSACTION_COLUMN_OPTIONS.map((column) => {
                      const checked = draftColumns.includes(column.key);
                      return (
                        <label
                          key={column.key}
                          className="flex cursor-pointer items-center gap-3 rounded border border-transparent p-2 font-mono text-xs hover:border-[var(--admin-border)] hover:bg-[var(--admin-surface)]"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              setDraftColumns((current) => {
                                if (current.includes(column.key)) {
                                  const next = current.filter((key) => key !== column.key);
                                  return next.length > 0 ? next : current;
                                }
                                return [...current, column.key];
                              });
                            }}
                            className="h-4 w-4 accent-[var(--admin-primary)]"
                          />
                          <span>{column.label}</span>
                        </label>
                      );
                    })}
                  </div>
                  <div className="flex items-center justify-between border-t border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
                    <button
                      type="button"
                      className="font-mono text-xs font-bold uppercase tracking-wide text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]"
                      onClick={() => {
                        setDraftColumns(DEFAULT_COLUMNS);
                      }}
                    >
                      Reset to default
                    </button>
                    <button
                      type="button"
                      className="rounded bg-[var(--admin-primary)] px-4 py-2 font-mono text-xs font-bold uppercase tracking-wide text-[var(--admin-on-primary)]"
                      onClick={() => {
                        setColumns(draftColumns);
                        setColumnsOpen(false);
                        setPage(1);
                      }}
                    >
                      Apply
                    </button>
                  </div>
                </div>
              ) : null}
            </div>

            <button
              type="button"
              className="inline-flex h-9 items-center gap-2 rounded border border-[var(--admin-primary)] bg-transparent px-3 font-mono text-xs font-bold uppercase tracking-wide text-[var(--admin-primary)] transition-colors hover:bg-[color-mix(in_srgb,var(--admin-primary)_10%,transparent)] disabled:opacity-50"
              disabled={busy || loading}
              onClick={() => void handleExport(false)}
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Export CSV
            </button>
            <button
              type="button"
              className="inline-flex h-9 items-center gap-2 rounded bg-[var(--admin-primary)] px-4 font-mono text-xs font-bold uppercase tracking-wide text-[var(--admin-on-primary)]"
              onClick={() => {
                router.push("/admin/reports/payments?tab=instalment");
              }}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Record payment
            </button>
          </div>
        </div>

        <div className="flex gap-4 overflow-x-auto">
          {(
            [
              { key: "all", label: "All" },
              { key: "failed_today", label: "Failed today" },
              { key: "refund_candidates", label: "Refund candidates" },
              { key: "high_value", label: "High value" },
            ] as const
          ).map((item) => (
            <button
              key={item.key}
              type="button"
              className={[
                "whitespace-nowrap px-4 py-2 font-mono text-xs transition-colors",
                view === item.key
                  ? "border-b-2 border-[var(--admin-primary)] font-bold text-[var(--admin-primary)]"
                  : "text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-primary)]",
              ].join(" ")}
              onClick={() => {
                applyView(item.key);
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="sticky top-0 z-20 flex flex-col gap-3 border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex min-w-[200px] flex-1 items-center border-b border-[var(--admin-border)] focus-within:border-[var(--admin-primary)]">
            <Search className="absolute left-2 h-4 w-4 text-[var(--admin-on-surface-variant)]" />
            <input
              className="w-full bg-transparent py-1.5 pl-8 pr-2 font-mono text-xs outline-none placeholder:text-[var(--admin-on-surface-variant)]"
              placeholder="Search learner..."
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
            />
          </div>
          <Select
            value={dateField}
            onValueChange={(value) => {
              setDateField(value as DateField);
              setPage(1);
            }}
            options={DATE_FIELD_OPTIONS}
            ariaLabel="Date field"
            className="h-9 min-w-[160px]"
          />
          <Select
            value={status}
            onValueChange={(value) => {
              setStatus(value);
              setPage(1);
            }}
            options={STATUS_OPTIONS}
            ariaLabel="Status"
            className="h-9 min-w-[140px]"
          />
          <Select
            value={gatewayKey}
            onValueChange={(value) => {
              setGatewayKey(value);
              setPage(1);
            }}
            options={gatewayOptions}
            ariaLabel="Gateway"
            className="h-9 min-w-[150px]"
          />
          <button
            type="button"
            className="inline-flex items-center gap-1 px-2 py-1 font-mono text-xs text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-primary)]"
            onClick={() => {
              setSearchApplied(search.trim());
              setPage(1);
            }}
          >
            <Check className="h-3.5 w-3.5" aria-hidden="true" />
            Apply
          </button>
        </div>

        {activeFilterChips.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 font-mono text-xs text-[var(--admin-on-surface-variant)]">
              Active filters:
            </span>
            {activeFilterChips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                className="inline-flex items-center gap-1 rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface-variant)] px-2 py-0.5 font-mono text-xs"
                onClick={chip.clear}
              >
                {chip.label}
                <X className="h-3.5 w-3.5 text-[var(--admin-danger)]" aria-hidden="true" />
              </button>
            ))}
            <button
              type="button"
              className="ml-1 font-mono text-xs text-[var(--admin-on-surface-variant)] underline hover:text-[var(--admin-on-surface)]"
              onClick={clearAllFilters}
            >
              Clear all
            </button>
          </div>
        ) : null}
      </div>

      {error ? (
        <div className="flex items-center justify-between gap-4 border border-[var(--admin-danger)] bg-[color-mix(in_srgb,var(--admin-danger)_12%,transparent)] p-4">
          <div className="flex items-center gap-3 text-[var(--admin-danger)]">
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
            <div>
              <p className="text-sm font-bold">Couldn&apos;t load transaction data</p>
              <p className="font-mono text-xs opacity-80">{error}</p>
            </div>
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded border border-[var(--admin-danger)] px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-wide text-[var(--admin-danger)] hover:bg-[color-mix(in_srgb,var(--admin-danger)_10%,transparent)]"
            onClick={() => void loadTransactions()}
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            Retry
          </button>
        </div>
      ) : null}

      {loading ? (
        <div
          className="border border-[var(--admin-border)] bg-[var(--admin-surface)]"
          aria-busy="true"
        >
          <div className="grid grid-cols-12 gap-4 border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Shimmer key={index} className="col-span-2 h-3" />
            ))}
          </div>
          {Array.from({ length: 10 }).map((_, index) => (
            <div
              key={index}
              className="grid grid-cols-12 items-center gap-4 border-b border-[var(--admin-border)] px-4 py-3 last:border-0"
            >
              <Shimmer className="col-span-2 h-4 w-24" />
              <Shimmer className="col-span-2 h-4 w-20" />
              <div className="col-span-3 flex items-center gap-3">
                <Shimmer className="h-6 w-6 rounded-full" />
                <Shimmer className="h-4 w-32" />
              </div>
              <Shimmer className="col-span-2 h-4 w-16" />
              <Shimmer className="col-span-2 h-6 w-20" />
              <Shimmer className="col-span-1 ml-auto h-6 w-6" />
            </div>
          ))}
        </div>
      ) : null}

      {!loading && error ? (
        <div
          className="pointer-events-none select-none overflow-hidden border border-[var(--admin-border)] opacity-40 blur-[1px]"
          aria-hidden="true"
        >
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[var(--admin-border)] bg-[var(--admin-surface)]">
                <th className="p-4 font-mono text-[11px] uppercase text-[var(--admin-on-surface-variant)]">
                  Learner
                </th>
                <th className="p-4 font-mono text-[11px] uppercase text-[var(--admin-on-surface-variant)]">
                  Amount
                </th>
                <th className="p-4 font-mono text-[11px] uppercase text-[var(--admin-on-surface-variant)]">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 4 }).map((_, index) => (
                <tr key={index} className="border-b border-[var(--admin-border)]">
                  <td className="p-4">
                    <Shimmer className="h-4 w-32" />
                  </td>
                  <td className="p-4">
                    <Shimmer className="h-4 w-16" />
                  </td>
                  <td className="p-4">
                    <Shimmer className="h-6 w-20" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {showEmpty ? (
        <div className="flex min-h-[360px] flex-col items-center justify-center rounded-lg border border-dashed border-[var(--admin-border)] bg-[var(--admin-surface)] p-8">
          <div className="relative mb-6 flex h-28 w-28 items-center justify-center">
            <div className="absolute inset-0 rounded-full bg-[var(--admin-surface-low)] opacity-60 blur-xl" />
            <Search
              className="relative z-10 h-16 w-16 text-[var(--admin-outline)]"
              strokeWidth={1.25}
            />
          </div>
          <h2 className="mb-2 text-center text-xl font-semibold text-[var(--admin-on-surface)]">
            No transactions match these filters
          </h2>
          <p className="mb-8 max-w-md text-center text-sm text-[var(--admin-on-surface-variant)]">
            Try adjusting your date range or removing status filters to see more results in the
            ledger.
          </p>
          {hasFilters ? (
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded bg-[var(--admin-primary)] px-6 py-3 font-mono text-xs font-bold uppercase tracking-wide text-[var(--admin-on-primary)]"
              onClick={clearAllFilters}
            >
              Reset filters
            </button>
          ) : null}
        </div>
      ) : null}

      {!loading && !error && items.length > 0 ? (
        <div className="relative overflow-hidden border border-[var(--admin-border)] bg-[var(--admin-surface)]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] border-collapse text-left">
              <thead className="sticky top-0 z-10 border-y border-[var(--admin-border)] bg-[var(--admin-surface-low)]">
                <tr>
                  <th className="w-10 p-2 text-center">
                    <input
                      type="checkbox"
                      checked={selectedIds.size > 0 && selectedIds.size === items.length}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 accent-[var(--admin-primary)]"
                      aria-label="Select all on page"
                    />
                  </th>
                  {showCol("learner_name") || showCol("email") ? (
                    <th className="p-2 font-mono text-[11px] font-bold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                      Learner
                    </th>
                  ) : null}
                  {showCol("product_title") || showCol("product_type") ? (
                    <th className="p-2 font-mono text-[11px] font-bold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                      Product
                    </th>
                  ) : null}
                  {showCol("gateway_key") ? (
                    <th className="p-2 font-mono text-[11px] font-bold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                      Gateway / ID
                    </th>
                  ) : null}
                  {showCol("coupon_amount_cents") ? (
                    <th className="p-2 font-mono text-[11px] font-bold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                      Coupon
                    </th>
                  ) : null}
                  {showCol("amount_cents") ? (
                    <th className="p-2 text-right font-mono text-[11px] font-bold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                      Amount
                    </th>
                  ) : null}
                  {showCol("currency") ? (
                    <th className="p-2 font-mono text-[11px] font-bold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                      Currency
                    </th>
                  ) : null}
                  {showCol("status") ? (
                    <th className="p-2 font-mono text-[11px] font-bold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                      Status
                    </th>
                  ) : null}
                  {showCol("invoice_number") ? (
                    <th className="p-2 font-mono text-[11px] font-bold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                      Invoice
                    </th>
                  ) : null}
                  {showCol("paid_at") || showCol("created_at") ? (
                    <th className="p-2 font-mono text-[11px] font-bold uppercase tracking-wide text-[var(--admin-primary)]">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1"
                        onClick={() => {
                          setSortBy("paid_at");
                          setSortDir((current) => (current === "desc" ? "asc" : "desc"));
                        }}
                      >
                        Tx date
                        <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </th>
                  ) : null}
                  <th className="w-10 p-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--admin-border)] text-sm">
                {items.map((item) => {
                  const badge = statusBadge(item.status);
                  const isRefunded = item.status.toLowerCase().includes("refund");
                  return (
                    <tr
                      key={item.id}
                      className={[
                        "group cursor-pointer transition-colors",
                        isRefunded
                          ? "bg-[color-mix(in_srgb,var(--admin-danger)_3%,transparent)] hover:bg-[color-mix(in_srgb,var(--admin-danger)_6%,transparent)]"
                          : "hover:bg-[var(--admin-surface-low)]",
                      ].join(" ")}
                      onClick={() => {
                        setDrawerOrderId(item.id);
                      }}
                    >
                      <td
                        className="p-2 text-center"
                        onClick={(event) => {
                          event.stopPropagation();
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selectedIds.has(item.id)}
                          onChange={() => {
                            toggleSelect(item.id);
                          }}
                          className="h-4 w-4 accent-[var(--admin-primary)]"
                          aria-label={`Select ${item.learnerName ?? item.id}`}
                        />
                      </td>
                      {showCol("learner_name") || showCol("email") ? (
                        <td className={`p-2 ${isRefunded ? "opacity-70" : ""}`}>
                          {showCol("learner_name") ? (
                            <div className="font-semibold text-[var(--admin-on-surface)]">
                              {item.learnerName ?? "Learner"}
                            </div>
                          ) : null}
                          {showCol("email") ? (
                            <div className="font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                              {item.email ?? "-"}
                            </div>
                          ) : null}
                        </td>
                      ) : null}
                      {showCol("product_title") || showCol("product_type") ? (
                        <td className={`p-2 ${isRefunded ? "opacity-70" : ""}`}>
                          {showCol("product_title") ? (
                            <div className="max-w-[160px] truncate">{item.productTitle ?? "-"}</div>
                          ) : null}
                          {showCol("product_type") && item.productType ? (
                            <span className="mt-1 inline-block rounded bg-[var(--admin-surface-variant)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--admin-on-surface-variant)]">
                              {item.productType}
                            </span>
                          ) : null}
                        </td>
                      ) : null}
                      {showCol("gateway_key") ? (
                        <td className={`p-2 font-mono text-xs ${isRefunded ? "opacity-70" : ""}`}>
                          <div className="flex items-center gap-1">
                            <span
                              className={`rounded-sm px-1 text-[10px] font-bold uppercase ${gatewayTone(item.gatewayKey)}`}
                            >
                              {(item.gatewayKey ?? "manual").slice(0, 10)}
                            </span>
                            <span>{truncateId(item.externalId)}</span>
                          </div>
                          {item.externalId ? (
                            <button
                              type="button"
                              className="mt-1 inline-flex items-center gap-1 text-[var(--admin-on-surface-variant)] opacity-0 transition-opacity hover:text-[var(--admin-on-surface)] group-hover:opacity-100"
                              onClick={(event) => {
                                event.stopPropagation();
                                void copyExternalId(item.externalId);
                              }}
                            >
                              <Copy className="h-3 w-3" aria-hidden="true" />
                              Copy ID
                            </button>
                          ) : null}
                        </td>
                      ) : null}
                      {showCol("coupon_amount_cents") ? (
                        <td className="p-2 font-mono text-xs text-[var(--admin-on-surface-variant)]">
                          {item.couponAmountCents && item.couponAmountCents > 0 ? (
                            <span className="text-[var(--admin-danger)]">
                              -{formatAmount(item.couponAmountCents)}
                            </span>
                          ) : (
                            "-"
                          )}
                        </td>
                      ) : null}
                      {showCol("amount_cents") ? (
                        <td
                          className={[
                            "p-2 text-right font-mono text-xs font-medium",
                            isRefunded
                              ? "text-[var(--admin-on-surface-variant)] line-through opacity-70"
                              : "text-[var(--admin-on-surface)]",
                          ].join(" ")}
                        >
                          {formatAmount(item.amountCents)}
                        </td>
                      ) : null}
                      {showCol("currency") ? (
                        <td className="p-2 font-mono text-xs text-[var(--admin-on-surface-variant)]">
                          {item.currency}
                        </td>
                      ) : null}
                      {showCol("status") ? (
                        <td className="p-2">
                          <span
                            className={`rounded-full border px-2 py-0.5 font-mono text-[10px] font-bold tracking-wide ${badge.className}`}
                          >
                            {badge.label}
                          </span>
                        </td>
                      ) : null}
                      {showCol("invoice_number") ? (
                        <td className={`p-2 font-mono text-xs ${isRefunded ? "opacity-70" : ""}`}>
                          {item.invoiceNumber ? (
                            <button
                              type="button"
                              className="text-[var(--admin-primary)] hover:underline"
                              onClick={() => void handleDownloadInvoice(item.id)}
                            >
                              {item.invoiceNumber}
                            </button>
                          ) : (
                            <span className="text-[var(--admin-on-surface-variant)]">-</span>
                          )}
                        </td>
                      ) : null}
                      {showCol("paid_at") || showCol("created_at") ? (
                        <td className={`p-2 font-mono text-xs ${isRefunded ? "opacity-70" : ""}`}>
                          <div className="text-[var(--admin-on-surface)]">
                            {formatRelative(item.paidAt ?? item.createdAt)}
                          </div>
                          <div className="text-[11px] text-[var(--admin-on-surface-variant)]">
                            {formatAbsolute(item.paidAt ?? item.createdAt)}
                          </div>
                        </td>
                      ) : null}
                      <td
                        className="relative p-2 text-right"
                        onClick={(event) => {
                          event.stopPropagation();
                        }}
                      >
                        <button
                          type="button"
                          className="text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]"
                          onClick={(event) => {
                            event.stopPropagation();
                            setRowMenuId((current) => (current === item.id ? null : item.id));
                          }}
                          aria-label="Row actions"
                        >
                          <MoreVertical className="h-4 w-4" aria-hidden="true" />
                        </button>
                        {rowMenuId === item.id ? (
                          <div className="absolute right-2 top-8 z-20 min-w-[180px] rounded border border-[var(--admin-border)] bg-[var(--admin-surface-high)] py-1 shadow-lg">
                            <button
                              type="button"
                              className="block w-full px-3 py-2 text-left font-mono text-xs hover:bg-[var(--admin-surface)]"
                              onClick={() => {
                                setRowMenuId(null);
                                setDrawerOrderId(item.id);
                              }}
                            >
                              Quick view
                            </button>
                            <button
                              type="button"
                              className="block w-full px-3 py-2 text-left font-mono text-xs hover:bg-[var(--admin-surface)]"
                              onClick={() => {
                                setRowMenuId(null);
                                router.push(`/admin/reports/payments/transactions/${item.id}`);
                              }}
                            >
                              Open detail
                            </button>
                            {item.invoiceNumber ? (
                              <button
                                type="button"
                                className="block w-full px-3 py-2 text-left font-mono text-xs hover:bg-[var(--admin-surface)]"
                                onClick={() => void handleDownloadInvoice(item.id)}
                              >
                                Download invoice
                              </button>
                            ) : null}
                            {item.externalId ? (
                              <button
                                type="button"
                                className="block w-full px-3 py-2 text-left font-mono text-xs hover:bg-[var(--admin-surface)]"
                                onClick={() => void copyExternalId(item.externalId)}
                              >
                                Copy external ID
                              </button>
                            ) : null}
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {selectedIds.size > 0 ? (
            <div className="sticky bottom-4 z-30 mx-auto mt-4 flex w-fit items-center gap-6 rounded border border-[var(--admin-primary)] bg-[var(--admin-surface-high)] px-4 py-2 shadow-lg">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-[var(--admin-primary)]" aria-hidden="true" />
                <span className="font-mono text-xs font-bold">
                  {selectedIds.size} transaction{selectedIds.size === 1 ? "" : "s"} selected
                </span>
                <span className="font-mono text-xs text-[var(--admin-on-surface-variant)]">
                  · {formatMoney(selectedTotal, totals.currency)}
                </span>
              </div>
              <div className="flex items-center gap-3 border-l border-[var(--admin-border)] pl-4">
                <button
                  type="button"
                  className="font-mono text-xs font-bold uppercase tracking-wide hover:text-[var(--admin-primary)]"
                  disabled={busy}
                  onClick={() => void handleExport(true)}
                >
                  Export selected
                </button>
              </div>
              <button
                type="button"
                className="text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]"
                onClick={() => {
                  setSelectedIds(new Set());
                }}
                aria-label="Clear selection"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {!loading && !error ? (
        <div className="flex flex-col justify-between gap-3 border-t border-[var(--admin-border)] py-3 sm:flex-row sm:items-center">
          <div className="flex flex-wrap items-center gap-4 font-mono text-xs">
            <div className="flex items-center gap-2">
              <span className="text-[var(--admin-on-surface-variant)]">Page total:</span>
              <span className="font-bold text-[var(--admin-on-surface)]">
                {formatMoney(totals.pageAmountCents, totals.currency)}
              </span>
            </div>
            <div className="hidden h-4 w-px bg-[var(--admin-border)] sm:block" />
            <div className="flex items-center gap-2">
              <span className="text-[var(--admin-on-surface-variant)]">Filtered total:</span>
              <span className="font-bold text-[var(--admin-on-surface)]">
                {formatMoney(totals.filteredAmountCents, totals.currency)}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 font-mono text-xs text-[var(--admin-on-surface-variant)]">
              <span>Rows</span>
              <Select
                value={String(pageSize)}
                onValueChange={(value) => {
                  setPageSize(Number(value));
                  setPage(1);
                }}
                options={PAGE_SIZE_OPTIONS}
                ariaLabel="Rows per page"
                className="h-8 min-w-[72px]"
              />
            </div>
            <div className="font-mono text-xs text-[var(--admin-on-surface-variant)]">
              {rangeStart}-{rangeEnd} of {totalCount}
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="p-1 text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-primary)] disabled:opacity-40"
                disabled={page <= 1}
                onClick={() => {
                  setPage((current) => Math.max(1, current - 1));
                }}
                aria-label="Previous page"
              >
                <ChevronLeft className="h-5 w-5" aria-hidden="true" />
              </button>
              <button
                type="button"
                className="p-1 text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-primary)] disabled:opacity-40"
                disabled={page >= totalPages || totalPages === 0}
                onClick={() => {
                  setPage((current) => current + 1);
                }}
                aria-label="Next page"
              >
                <ChevronRight className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <AdminPaymentTransactionDrawer
        orderId={drawerOrderId}
        onClose={() => {
          setDrawerOrderId(null);
        }}
      />
    </div>
  );
}
